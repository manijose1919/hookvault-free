import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';
import { createFeatureGate } from '../shared/feature-gate.js';
import { loadModules, migrateModules } from '../shared/module-loader.js';
import { logger } from '../shared/logger.js';

// Composition root: wire config -> db -> modules -> gate -> app -> listen.

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  migrate(db);

  const { features, modules } = await loadModules(config.tier);
  migrateModules(modules, db);
  const gate = createFeatureGate(config.tier, features);

  const app = createApp({ db, config, gate, modules });

  const server = app.listen(config.port, config.host, () => {
    logger.info('hookvault_started', {
      host: config.host,
      port: config.port,
      tier: config.tier,
      features: gate.activeFeatures(),
    });
  });

  const shutdown = (signal) => {
    logger.info('shutting_down', { signal });
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('startup_failed', { message: err.message, stack: err.stack });
  process.exit(1);
});
