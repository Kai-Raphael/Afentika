import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

/** Minimale D1-compatibele wrapper rond node:sqlite, genoeg voor de tests. */
export function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params).map((row) => ({ ...row })) }),
    run: async () => ({ meta: sqlite.prepare(sql).run(...params) }),
  });

  return {
    sqlite,
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) results.push(await stmt.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function seedPlayer(db, { name, code, alive = 1 }) {
  return db.sqlite
    .prepare("INSERT INTO lustrum_players (name, code, role, mission, alive) VALUES (?, ?, 'Butler', 'Geheim', ?)")
    .run(name, code, alive).lastInsertRowid;
}

export function seedQuestion(db, { key = 'q1', number = 1, slug, pin = '1234', answers, points = 2, maxAttempts = 3 }) {
  return db.sqlite
    .prepare(
      `INSERT INTO lustrum_questions (key, number, slug, pin, title, body, answers, points, max_attempts)
       VALUES (?, ?, ?, ?, 'Titel', 'Vraagtekst', ?, ?, ?)`,
    )
    .run(key, number, slug, pin, JSON.stringify(answers), points, maxAttempts).lastInsertRowid;
}
