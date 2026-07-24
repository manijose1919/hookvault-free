import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Opens a SQLite database using the runtime's built-in driver (no native
// build step). Pass ':memory:' for ephemeral test databases.

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');

  // WAL improves read/write concurrency for on-disk databases; it is a no-op
  // (and unsupported) for in-memory databases.
  if (databasePath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  return db;
}
