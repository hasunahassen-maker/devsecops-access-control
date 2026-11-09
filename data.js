const bcrypt = require('bcryptjs');

async function seed(staffPassword) {
  const passwordHash = await bcrypt.hash(staffPassword, 12);
  const users = [];
  for (const branchId of ['bole', 'piassa']) {
    for (const role of ['waiter', 'cashier', 'manager']) {
      const id = branchId + '-' + role;
      users.push({ id, email: id + '@example.test', role, branchId, passwordHash, active: true });
    }
  }
  users.push({ id: 'admin', email: 'admin@example.test', role: 'admin', branchId: null,
    passwordHash, active: true });
  const orders = ['bole', 'bole', 'piassa', 'piassa'].map((branchId, index) => ({
    id: String(index + 1), branchId, item: 'Lunch', totalCents: 1000, paid: false,
    createdAt: new Date().toISOString(),
  }));
  return { users, orders, dummyHash: await bcrypt.hash('dummy-login-comparison', 12) };
}

module.exports = { seed };
