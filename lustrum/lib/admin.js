import { HttpError } from './http.js';
import { openRound } from './game.js';

export async function getAdminState(db) {
  const round = await openRound(db);
  const [players, questions, ledger, lastClosedRound] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.name, p.code, p.role, p.mission, p.alive, COALESCE(SUM(l.amount), 0) AS points
         FROM lustrum_players p LEFT JOIN lustrum_ledger l ON l.player_id = p.id
         GROUP BY p.id ORDER BY points DESC, p.name`,
      )
      .all(),
    db
      .prepare(
        `SELECT q.number, q.title, q.points,
                (SELECT COUNT(*) FROM lustrum_ledger l WHERE l.question_id = q.id) AS solves
         FROM lustrum_questions q ORDER BY q.number`,
      )
      .all(),
    db
      .prepare(
        `SELECT l.created_at, p.name, l.amount, l.reason
         FROM lustrum_ledger l JOIN lustrum_players p ON p.id = l.player_id
         ORDER BY l.id DESC LIMIT 50`,
      )
      .all(),
    db.prepare('SELECT * FROM lustrum_rounds WHERE closed_at IS NOT NULL ORDER BY id DESC LIMIT 1').first(),
  ]);

  return {
    players: players.results.map((player) => ({ ...player, alive: Boolean(player.alive) })),
    questions: questions.results,
    ledger: ledger.results,
    openRound: round && (await roundResult(db, round)),
    lastClosedRound: lastClosedRound && (await roundResult(db, lastClosedRound)),
  };
}

const ACTIONS = {
  async award(db, { playerId, amount, reason }) {
    const points = Number(amount);
    if (!Number.isInteger(points) || points === 0) throw new HttpError(400, 'Aantal punten moet een geheel getal ongelijk aan 0 zijn');
    if (!String(reason ?? '').trim()) throw new HttpError(400, 'Geef een reden op');
    await requirePlayerId(db, playerId);
    await db
      .prepare('INSERT INTO lustrum_ledger (player_id, amount, reason) VALUES (?, ?, ?)')
      .bind(Number(playerId), points, String(reason).trim())
      .run();
  },

  async setAlive(db, { playerId, alive }) {
    await requirePlayerId(db, playerId);
    await db
      .prepare('UPDATE lustrum_players SET alive = ? WHERE id = ?')
      .bind(alive ? 1 : 0, Number(playerId))
      .run();
  },

  async openRound(db, { label }) {
    if (await openRound(db)) throw new HttpError(409, 'Er is al een stemronde open');
    await db
      .prepare('INSERT INTO lustrum_rounds (label) VALUES (?)')
      .bind(String(label ?? '').trim() || 'Stemronde')
      .run();
  },

  async closeRound(db) {
    const round = await openRound(db);
    if (!round) throw new HttpError(409, 'Er is geen stemronde open');
    await db.prepare("UPDATE lustrum_rounds SET closed_at = datetime('now') WHERE id = ?").bind(round.id).run();
  },
};

export async function runAdminAction(db, { action, ...payload }) {
  const handler = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
  if (!handler) throw new HttpError(400, `Onbekende actie: ${action}`);
  await handler(db, payload);
  return getAdminState(db);
}

async function requirePlayerId(db, playerId) {
  const player = await db.prepare('SELECT id FROM lustrum_players WHERE id = ?').bind(Number(playerId)).first();
  if (!player) throw new HttpError(404, 'Speler bestaat niet');
}

async function roundResult(db, round) {
  const [tally, votes, missing] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.name, COUNT(*) AS votes
         FROM lustrum_votes v JOIN lustrum_players p ON p.id = v.target_id
         WHERE v.round_id = ? GROUP BY p.id ORDER BY votes DESC, p.name`,
      )
      .bind(round.id)
      .all(),
    db
      .prepare(
        `SELECT voter.name AS voter, target.name AS target
         FROM lustrum_votes v
         JOIN lustrum_players voter ON voter.id = v.voter_id
         JOIN lustrum_players target ON target.id = v.target_id
         WHERE v.round_id = ? ORDER BY voter.name`,
      )
      .bind(round.id)
      .all(),
    db
      .prepare(
        `SELECT name FROM lustrum_players
         WHERE alive = 1 AND id NOT IN (SELECT voter_id FROM lustrum_votes WHERE round_id = ?)
         ORDER BY name`,
      )
      .bind(round.id)
      .all(),
  ]);
  return {
    id: round.id,
    label: round.label,
    openedAt: round.opened_at,
    closedAt: round.closed_at,
    tally: tally.results,
    votes: votes.results,
    notVoted: missing.results.map((row) => row.name),
  };
}
