import { HttpError } from './http.js';

export const LIMITS = {
  playerCode: { kind: 'player-code', limit: 10, windowMinutes: 15 },
  pin: { kind: 'pin', limit: 8, windowMinutes: 15 },
};

export async function assertNotThrottled(db, { kind, limit, windowMinutes }, key) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS failures FROM lustrum_failures
       WHERE kind = ? AND key = ? AND created_at > datetime('now', ?)`,
    )
    .bind(kind, String(key), `-${windowMinutes} minutes`)
    .first();
  if (row.failures >= limit) {
    throw new HttpError(429, `Te veel foute pogingen. Probeer het over ${windowMinutes} minuten opnieuw.`);
  }
}

export async function recordFailure(db, { kind }, key) {
  await db.prepare('INSERT INTO lustrum_failures (kind, key) VALUES (?, ?)').bind(kind, String(key)).run();
}
