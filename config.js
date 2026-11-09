function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) throw new Error('JWT_SECRET is required');
  if (jwtSecret.trim().length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  const demoPassword = env.DINEDESK_SEED_PASSWORD;
  if (!demoPassword || Buffer.byteLength(demoPassword) > 72) {
    throw new Error('DINEDESK_SEED_PASSWORD must contain 1 to 72 bytes');
  }
  return { jwtSecret, demoPassword, issuer: 'dinedesk-auth', audience: 'dinedesk-api' };
}

module.exports = { loadConfig };
