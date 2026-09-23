/** POST /api/lustrum/question { slug, pin } → vraagtekst voor wie de sticker gevonden heeft. */
import { requirePlayer } from '../../../lustrum/lib/auth.js';
import { unlockQuestion } from '../../../lustrum/lib/game.js';
import { json, readJson, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  const player = await requirePlayer(request, env.AFENTIKA_DB);
  return json(await unlockQuestion(env.AFENTIKA_DB, player, await readJson(request)));
});
