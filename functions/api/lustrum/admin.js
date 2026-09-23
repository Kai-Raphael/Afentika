/**
 * GET  /api/lustrum/admin            → volledige spelstand voor de spelleider
 * POST /api/lustrum/admin { action } → award | setAlive | openRound | closeRound
 */
import { getAdminState, runAdminAction } from '../../../lustrum/lib/admin.js';
import { requireAdmin } from '../../../lustrum/lib/auth.js';
import { json, readJson, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestGet = withErrors(async ({ request, env }) => {
  requireAdmin(request, env);
  return json(await getAdminState(env.AFENTIKA_DB));
});

export const onRequestPost = withErrors(async ({ request, env }) => {
  requireAdmin(request, env);
  return json(await runAdminAction(env.AFENTIKA_DB, await readJson(request)));
});
