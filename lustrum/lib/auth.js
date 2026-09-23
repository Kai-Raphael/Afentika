import { normalizePlayerCode } from './codes.js';
import { HttpError, bearerToken, clientIp } from './http.js';
import { LIMITS, assertNotThrottled, recordFailure } from './throttle.js';

export async function requirePlayer(request, db) {
  const ip = clientIp(request);
  await assertNotThrottled(db, LIMITS.playerCode, ip);

  const code = normalizePlayerCode(bearerToken(request));
  const player = code
    ? await db.prepare('SELECT * FROM lustrum_players WHERE code = ?').bind(code).first()
    : null;

  if (!player) {
    await recordFailure(db, LIMITS.playerCode, ip);
    throw new HttpError(401, 'Onbekende spelerscode');
  }
  return player;
}

export function requireAdmin(request, env) {
  const expected = env.LUSTRUM_ADMIN_PASSWORD;
  if (!expected) throw new HttpError(500, 'LUSTRUM_ADMIN_PASSWORD is niet ingesteld');
  if (!constantTimeEquals(bearerToken(request), expected)) {
    throw new HttpError(401, 'Verkeerd admin-wachtwoord');
  }
}

function constantTimeEquals(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < right.length; i++) difference |= (left[i] ?? 0) ^ right[i];
  return difference === 0;
}
