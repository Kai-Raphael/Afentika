/**
 * Cloudflare Pages Function: /api/sync
 *
 * GET  /api/sync  → haal de huidige event state op
 * POST /api/sync  → sla de volledige event state op (vereist wachtwoord)
 */

const ADMIN_PASSWORD = 'afentika2025'; // ← zelfde als in app.html
const STATE_KEY      = 'tripleA_event_state';

export async function onRequestGet({ env }) {
  try {
    const row = await env.AFENTIKA_DB
      .prepare('SELECT data FROM sync_state WHERE key = ?1')
      .bind(STATE_KEY)
      .first();

    if (!row) return json({ data: null });

    return json({ data: JSON.parse(row.data) });
  } catch (e) {
    return json({ error: 'Database error', detail: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body)                          return json({ error: 'Invalid JSON' }, 400);
  if (body.password !== ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
  if (!body.data)                     return json({ error: 'data required' }, 400);

  try {
    await env.AFENTIKA_DB
      .prepare(`
        INSERT INTO sync_state (key, data, updated_at)
        VALUES (?1, ?2, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET data = ?2, updated_at = datetime('now')
      `)
      .bind(STATE_KEY, JSON.stringify(body.data))
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Database error', detail: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}