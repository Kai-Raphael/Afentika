/** POST /api/lustrum/vote { targetId } → stem (of wijzig je stem) in de open stemronde. */
import { requirePlayer } from '../../../lustrum/lib/auth.js';
import { castVote } from '../../../lustrum/lib/game.js';
import { json, readJson, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestPost = withErrors(async ({ request, env }) => {
  const player = await requirePlayer(request, env.AFENTIKA_DB);
  return json(await castVote(env.AFENTIKA_DB, player, await readJson(request)));
});
