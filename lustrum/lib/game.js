import { isCorrectAnswer } from './answers.js';
import { HttpError } from './http.js';
import { LIMITS, assertNotThrottled, recordFailure } from './throttle.js';

// Zelfde melding voor onbekende link en foute pincode: geen hint voor raders.
const UNKNOWN_QUESTION = 'Onbekende vraag of verkeerde pincode';

export async function getOverview(db, player) {
  const [points, solved, round] = await Promise.all([
    pointsOf(db, player.id),
    db
      .prepare(
        `SELECT q.number, q.title FROM lustrum_ledger l
         JOIN lustrum_questions q ON q.id = l.question_id
         WHERE l.player_id = ? ORDER BY q.number`,
      )
      .bind(player.id)
      .all(),
    openRound(db),
  ]);

  return {
    player: {
      name: player.name,
      role: player.role,
      roleDescription: player.role_description,
      mission: player.mission,
      alive: Boolean(player.alive),
    },
    points,
    solved: solved.results,
    round: round && (await roundForVoter(db, round, player)),
  };
}

export async function unlockQuestion(db, player, { slug, pin }) {
  const question = await findUnlockedQuestion(db, player, { slug, pin });
  const progress = await progressOn(db, player, question);
  return {
    number: question.number,
    title: question.title,
    body: question.body,
    points: question.points,
    ...progress,
  };
}

export async function submitAnswer(db, player, { slug, pin, answer }) {
  const question = await findUnlockedQuestion(db, player, { slug, pin });
  if (!player.alive) throw new HttpError(403, 'Je bent uitgeschakeld en kunt geen punten meer verdienen');

  const progress = await progressOn(db, player, question);
  if (progress.solved) return { correct: true, ...progress };
  if (progress.attemptsLeft === 0) throw new HttpError(409, 'Je hebt geen pogingen meer voor deze vraag');
  if (!String(answer ?? '').trim()) throw new HttpError(400, 'Vul een antwoord in');

  const correct = isCorrectAnswer(answer, JSON.parse(question.answers));
  const statements = [
    db
      .prepare('INSERT INTO lustrum_attempts (player_id, question_id, answer, correct) VALUES (?, ?, ?, ?)')
      .bind(player.id, question.id, String(answer).slice(0, 200), correct ? 1 : 0),
  ];
  if (correct) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO lustrum_ledger (player_id, amount, reason, question_id)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(player.id, question.points, `Vraag ${question.number}: ${question.title}`, question.id),
    );
  }
  await db.batch(statements);

  return { correct, ...(await progressOn(db, player, question)) };
}

export async function castVote(db, player, { targetId }) {
  if (!player.alive) throw new HttpError(403, 'Uitgeschakelde spelers mogen niet stemmen');

  const round = await openRound(db);
  if (!round) throw new HttpError(409, 'Er is geen stemronde open');

  const target = await db
    .prepare('SELECT id, alive FROM lustrum_players WHERE id = ?')
    .bind(Number(targetId))
    .first();
  if (!target || !target.alive) throw new HttpError(400, 'Je kunt alleen stemmen op spelers die nog in het spel zitten');
  if (target.id === player.id) throw new HttpError(400, 'Je kunt niet op jezelf stemmen');

  await db
    .prepare(
      `INSERT INTO lustrum_votes (round_id, voter_id, target_id) VALUES (?, ?, ?)
       ON CONFLICT (round_id, voter_id) DO UPDATE SET target_id = excluded.target_id, created_at = datetime('now')`,
    )
    .bind(round.id, player.id, target.id)
    .run();

  return roundForVoter(db, round, player);
}

export async function getScoreboard(db) {
  const { results } = await db
    .prepare(
      `SELECT p.name, p.alive, COALESCE(SUM(l.amount), 0) AS points
       FROM lustrum_players p LEFT JOIN lustrum_ledger l ON l.player_id = p.id
       GROUP BY p.id ORDER BY points DESC, p.name`,
    )
    .all();
  return results.map((row) => ({ name: row.name, alive: Boolean(row.alive), points: row.points }));
}

export async function openRound(db) {
  return db.prepare('SELECT * FROM lustrum_rounds WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').first();
}

async function findUnlockedQuestion(db, player, { slug, pin }) {
  await assertNotThrottled(db, LIMITS.pin, player.id);
  const question = await db
    .prepare('SELECT * FROM lustrum_questions WHERE slug = ?')
    .bind(String(slug ?? ''))
    .first();
  if (!question || question.pin !== String(pin ?? '').trim()) {
    await recordFailure(db, LIMITS.pin, player.id);
    throw new HttpError(404, UNKNOWN_QUESTION);
  }
  return question;
}

async function progressOn(db, player, question) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS attempts, COALESCE(MAX(correct), 0) AS solved
       FROM lustrum_attempts WHERE player_id = ? AND question_id = ?`,
    )
    .bind(player.id, question.id)
    .first();
  return {
    solved: Boolean(row.solved),
    attemptsLeft: row.solved ? 0 : Math.max(0, question.max_attempts - row.attempts),
  };
}

async function pointsOf(db, playerId) {
  const row = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS points FROM lustrum_ledger WHERE player_id = ?')
    .bind(playerId)
    .first();
  return row.points;
}

async function roundForVoter(db, round, player) {
  const [candidates, vote] = await Promise.all([
    db
      .prepare('SELECT id, name FROM lustrum_players WHERE alive = 1 AND id != ? ORDER BY name')
      .bind(player.id)
      .all(),
    db
      .prepare('SELECT target_id FROM lustrum_votes WHERE round_id = ? AND voter_id = ?')
      .bind(round.id, player.id)
      .first(),
  ]);
  return {
    id: round.id,
    label: round.label,
    canVote: Boolean(player.alive),
    votedFor: vote?.target_id ?? null,
    candidates: candidates.results,
  };
}
