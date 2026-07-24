import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/core/db/index.js';
import { migrate } from '../src/core/db/migrate.js';

test('migrate creates all core tables', () => {
  const db = openDatabase(':memory:');
  migrate(db);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);

  for (const expected of ['delivery_attempts', 'endpoints', 'events', 'sources']) {
    assert.ok(tables.includes(expected), `missing table: ${expected}`);
  }
  db.close();
});

test('migrate is idempotent', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  assert.doesNotThrow(() => migrate(db));
  db.close();
});

test('foreign keys are enforced', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  // Inserting an endpoint referencing a non-existent source must fail.
  assert.throws(() => {
    db.prepare('INSERT INTO endpoints (id, source_id, url) VALUES (?, ?, ?)').run(
      'ep_1',
      'src_missing',
      'https://example.com'
    );
  }, /FOREIGN KEY/);
  db.close();
});
