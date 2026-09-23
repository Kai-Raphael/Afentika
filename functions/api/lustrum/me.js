/** GET /api/lustrum/me → naam, rol, opdracht, punten en open stemronde van de speler. */
import { requirePlayer } from '../../../lustrum/lib/auth.js';
import { getOverview } from '../../../lustrum/lib/game.js';
import { json, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestGet = withErrors(async ({ request, env }) => {
  const player = await requirePlayer(request, env.AFENTIKA_DB);
  return json(await getOverview(env.AFENTIKA_DB, player));
});
