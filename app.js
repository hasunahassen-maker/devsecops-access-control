const { randomUUID } = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireRole, requirePermission, canAccessOrder } = require('./policy');

function createApp(config, { users, orders, dummyHash }) {
  const app = express();
  const { jwtSecret, issuer, audience } = config;
  app.use(express.json({ limit: '16kb' }));

  function authenticate(req, res, next) {
    const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(req.get('authorization') || '')?.[1];
    if (!token) return res.sendStatus(401);

    let claims;
    try {
      claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer, audience });
    } catch {
      return res.sendStatus(401);
    }

    if (typeof claims.sub !== 'string' || !Number.isFinite(claims.exp)) {
      return res.sendStatus(401);
    }
    const user = users.find(record => record.id === claims.sub && record.active);
    if (!user) return res.sendStatus(401);
    req.user = { id: user.id, role: user.role, branchId: user.branchId };
    next();
  }

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' ||
        !password || Buffer.byteLength(password) > 72) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users.find(record => record.email === email.trim().toLowerCase());
    const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!valid || !user?.active) return res.status(401).json({ error: 'Invalid credentials' });
    res.set('Cache-Control', 'no-store').json({
      accessToken: jwt.sign({}, jwtSecret, {
        algorithm: 'HS256', subject: user.id, issuer, audience, expiresIn: '15m',
      }),
    });
  });

  const readOrders = requirePermission('orders:read');
  app.get('/api/orders', authenticate, readOrders, (req, res) => {
    res.json(orders.filter(order => canAccessOrder(req.user, order)));
  });
  app.get('/api/orders/:id', authenticate, readOrders, (req, res) => {
    const order = orders.find(record => record.id === req.params.id);
    if (!order || !canAccessOrder(req.user, order)) return res.sendStatus(404);
    res.json(order);
  });
  app.post('/api/orders', authenticate, requirePermission('orders:create'), (req, res) => {
    const { item, totalCents } = req.body || {};
    if (typeof item !== 'string' || !item.trim() || !Number.isSafeInteger(totalCents) || totalCents <= 0) {
      return res.sendStatus(400);
    }
    const order = { id: randomUUID(), branchId: req.user.branchId, item: item.trim(),
      totalCents, paid: false, createdAt: new Date().toISOString() };
    if (!canAccessOrder(req.user, order)) return res.sendStatus(403);
    orders.push(order);
    res.status(201).json(order);
  });
  app.post('/api/payments', authenticate, requirePermission('payments:create'), (req, res) => {
    const order = orders.find(record => record.id === req.body?.orderId);
    if (!order || !canAccessOrder(req.user, order)) return res.sendStatus(404);
    if (order.paid) return res.sendStatus(409);
    order.paid = true;
    res.status(201).json({ paymentId: randomUUID(), orderId: order.id });
  });
  app.get('/api/reports/branch', authenticate, requirePermission('reports:read'), (req, res) => {
    const { branchId } = req.user;
    if (!branchId) return res.sendStatus(403);
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Addis_Ababa' });
    const today = date.format(new Date());
    const branchOrders = orders.filter(order =>
      order.branchId === branchId && date.format(new Date(order.createdAt)) === today);
    res.json({
      branchId, date: today, orderCount: branchOrders.length,
      paidTotalCents: branchOrders.filter(order => order.paid)
        .reduce((total, order) => total + order.totalCents, 0),
    });
  });
  app.get('/api/admin/users', authenticate, requireRole('admin'), (req, res) => {
    res.json(users.map(({ id, email, role, branchId, active }) => ({ id, email, role, branchId, active })));
  });

  return app;
}

module.exports = { createApp };
