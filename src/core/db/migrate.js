import { fileURLToPath } from 'node:url';
import { openDatabase } from './index.js';
import { SCHEMA_SQL } from './schema.js';
import { loadConfig } from '../config.js';
import { logger } from '../../shared/logger.js';

/** Apply the core schema to an existing db handle. Idempotent. */
export function migrate(db) {
  db.exec(SCHEMA_SQL);
  return db;
}

// CLI entry point: `npm run migrate`. Cross-platform check that this module is
// the process entry (avoids brittle file:// string comparison on Windows).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  migrate(db);
  logger.info('migration_complete', { databasePath: config.databasePath });
  db.close();
}
