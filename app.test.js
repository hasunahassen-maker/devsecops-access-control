const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { seed } = require('./data');

const config = loadConfig({
  JWT_SECRET: randomBytes(32).toString('hex'),
  DINEDESK_SEED_PASSWORD: randomBytes(18).toString('hex'),
});
let fixture;
let state;
let api;

beforeAll(async () => { fixture = await seed(config.demoPassword); });
beforeEach(() => {
  state = structuredClone(fixture);
  api = request(createApp(config, state));
});

function sign(subject, options = {}, key = config.jwtSecret) {
  return jwt.sign({}, key, {
    subject, issuer: config.issuer, audience: config.audience,
    algorithm: 'HS256', expiresIn: '15m', ...options,
  });
}

function as(call, subject) {
  return call.set('Authorization', 'Bearer ' + sign(subject));
}

test('no token returns 401', () => api.get('/api/orders').expect(401));
test('wrong signing key returns 401', () =>
  api.get('/api/orders').set('Authorization',
    'Bearer ' + sign('bole-waiter', {}, randomBytes(32))).expect(401));
test('expired token returns 401', () =>
  api.get('/api/orders').set('Authorization',
    'Bearer ' + sign('bole-waiter', { expiresIn: -1 })).expect(401));
test('wrong audience returns 401', () =>
  api.get('/api/orders').set('Authorization',
    'Bearer ' + sign('bole-waiter', { audience: 'elsewhere' })).expect(401));
test('non-Bearer scheme returns 401', () =>
  api.get('/api/orders').set('Authorization', 'Basic ' + sign('bole-waiter')).expect(401));
test('waiter cannot spoof admin through a header', () =>
  as(api.get('/api/admin/users'), 'bole-waiter').set('x-user-role', 'admin').expect(403));
test('admin can list users without password hashes', async () => {
  const { body } = await as(api.get('/api/admin/users'), 'admin').expect(200);
  expect(body).toHaveLength(7);
  for (const user of body) {
    expect(Object.keys(user).sort()).toEqual(['active', 'branchId', 'email', 'id', 'role']);
  }
});
test('waiter creates an order in their own branch', async () => {
  const { body } = await as(api.post('/api/orders'), 'bole-waiter')
    .send({ item: 'Lunch', totalCents: 1000, branchId: 'piassa' }).expect(201);
  expect(body.branchId).toBe('bole');
});
test('cashier cannot create an order', () =>
  as(api.post('/api/orders'), 'bole-cashier').send({ item: 'Lunch', totalCents: 1000 }).expect(403));
test('Bole manager reads a Bole order', () => as(api.get('/api/orders/1'), 'bole-manager').expect(200));
test('Bole manager receives 404 for a Piassa order', () =>
  as(api.get('/api/orders/3'), 'bole-manager').expect(404));
test('Bole manager list contains only Bole orders', async () => {
  const { body } = await as(api.get('/api/orders'), 'bole-manager').expect(200);
  expect(body.map(order => order.branchId)).toEqual(['bole', 'bole']);
});
test('cashier cannot pay for an order in the other branch', () =>
  as(api.post('/api/payments'), 'bole-cashier').send({ orderId: '3' }).expect(404));
test('cashier can pay once for their own branch order', async () => {
  await as(api.post('/api/payments'), 'bole-cashier').send({ orderId: '1' }).expect(201);
  await as(api.post('/api/payments'), 'bole-cashier').send({ orderId: '1' }).expect(409);
});
test('waiter cannot access the branch report', () =>
  as(api.get('/api/reports/branch'), 'piassa-waiter').expect(403));
test('Piassa report ignores a Bole branch query parameter', async () => {
  state.orders[0].paid = true;
  state.orders[2].paid = true;
  state.orders[2].totalCents = 2200;
  const normal = await as(api.get('/api/reports/branch'), 'piassa-manager').expect(200);
  const tampered = await as(api.get('/api/reports/branch?branchId=bole'), 'piassa-manager').expect(200);
  expect(tampered.body).toEqual(normal.body);
  expect(tampered.body).toMatchObject({ branchId: 'piassa', orderCount: 2, paidTotalCents: 2200 });
});
test('disabled user loses access with an existing token', async () => {
  const token = sign('bole-manager');
  state.users.find(user => user.id === 'bole-manager').active = false;
  await api.get('/api/orders').set('Authorization', 'Bearer ' + token).expect(401);
});
test('login ignores role and branch sent by the client', async () => {
  const { body } = await api.post('/api/auth/login').send({
    email: 'bole-waiter@example.test', password: config.demoPassword, role: 'admin', branchId: 'piassa',
  }).expect(200);
  const claims = jwt.verify(body.accessToken, config.jwtSecret, {
    algorithms: ['HS256'], issuer: config.issuer, audience: config.audience,
  });
  expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
  expect(claims.sub).toBe('bole-waiter');
  expect(claims.exp - claims.iat).toBe(900);
  await api.get('/api/admin/users').set('Authorization', 'Bearer ' + body.accessToken).expect(403);
});
test('unknown email and wrong password give the same response', async () => {
  const wrongEmail = await api.post('/api/auth/login')
    .send({ email: 'unknown@example.test', password: config.demoPassword }).expect(401);
  const wrongPassword = await api.post('/api/auth/login')
    .send({ email: 'bole-waiter@example.test', password: 'invented-invalid-password' }).expect(401);
  expect(wrongEmail.body).toEqual(wrongPassword.body);
});
test('unknown role receives no permissions', () => {
  state.users.find(user => user.id === 'bole-waiter').role = 'constructor';
  return as(api.get('/api/orders'), 'bole-waiter').expect(403);
});
