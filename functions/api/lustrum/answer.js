/** POST /api/lustrum/answer { slug, pin, answer } → controleert het antwoord en kent punten toe. */
import { requirePlayer } from '../../../lustrum/lib/auth.js';
import { submitAnswer } from '../../../lustrum/lib/game.js';
import { json, readJson, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  const player = await requirePlayer(request, env.AFENTIKA_DB);
  return json(await submitAnswer(env.AFENTIKA_DB, player, await readJson(request)));
});
