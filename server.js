const { loadConfig } = require('./config');

async function main() {
  const config = loadConfig();
  const { seed } = require('./data');
  const { createApp } = require('./app');
  createApp(config, await seed(config.demoPassword)).listen(3000, '127.0.0.1', () => {
    console.log('DineDesk listening on http://127.0.0.1:3000');
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
