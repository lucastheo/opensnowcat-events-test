import { loadConfig } from './config/env.js';
import { buildApp } from './app.js';

async function start() {
  const config = loadConfig();
  const app = await buildApp(config);

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(`Simple Collector listening on ${address}`);
    app.log.info(`Appending events to: ${config.csvFilePath}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
