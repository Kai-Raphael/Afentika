/** GET /api/lustrum/scoreboard → publieke ranglijst. */
import { getScoreboard } from '../../../lustrum/lib/game.js';
import { json, withErrors } from '../../../lustrum/lib/http.js';

export const onRequestGet = withErrors(async ({ env }) => json({ players: await getScoreboard(env.AFENTIKA_DB) }));
