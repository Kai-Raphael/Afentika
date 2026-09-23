/**
 * Pure logica achter de generator: content valideren, codes toekennen en de
 * seed-SQL opbouwen. Geen bestands-IO hier, zodat het goed te testen is.
 */
import { generatePin, generatePlayerCode, generateSlug } from '../lib/codes.js';

const TODO = /TODO/;

export function validateContent(content, { skipTodo = false } = {}) {
  const errors = [];
  const require = (condition, message) => condition || errors.push(message);

  require(/^https:\/\//.test(content.baseUrl ?? ''), 'baseUrl moet met https:// beginnen');
  require(Array.isArray(content.players) && content.players.length > 0, 'players ontbreekt');
  require(Array.isArray(content.questions) && content.questions.length > 0, 'questions ontbreekt');
  if (errors.length) return { errors, questions: [] };

  require(new Set(content.players).size === content.players.length, 'Dubbele spelersnamen');
  require(!content.players.some((name) => TODO.test(name)), 'players bevat nog TODO-namen');
  require((content.roles ?? []).length >= content.players.length, 'Minder rollen dan spelers');
  require((content.missions ?? []).length >= content.players.length, 'Minder opdrachten dan spelers');

  const keys = content.questions.map((q) => q.key);
  require(new Set(keys).size === keys.length, 'Dubbele vraag-keys');

  const questions = [];
  for (const question of content.questions) {
    const label = `Vraag "${question.key}"`;
    require(/^[a-z0-9-]+$/.test(question.key ?? ''), `${label}: key mag alleen a-z, 0-9 en - bevatten`);
    require(question.title && question.body, `${label}: title en body zijn verplicht`);
    require(Array.isArray(question.answers) && question.answers.length > 0, `${label}: answers is verplicht`);
    require(Number.isInteger(question.points) && question.points > 0, `${label}: points moet een positief geheel getal zijn`);
    if (question.maxAttempts !== undefined) {
      require(Number.isInteger(question.maxAttempts) && question.maxAttempts > 0, `${label}: maxAttempts moet een positief geheel getal zijn`);
    }
    if (question.anagramOf) require(question.body.includes('{anagram}'), `${label}: body mist {anagram}`);

    if (hasTodo(question)) {
      if (!skipTodo) errors.push(`${label}: bevat nog TODO (vul in, of draai met --skip-todo)`);
      continue;
    }
    questions.push(question);
  }
  return { errors, questions };
}

/**
 * Vult ontbrekende codes aan zonder bestaande te wijzigen. Zo blijven al
 * geprinte stickers en brieven geldig als je later vragen toevoegt.
 */
export function assign(content, questions, previous = { players: {}, questions: {} }) {
  const players = { ...previous.players };
  const usedRoles = new Set(Object.values(players).map((p) => p.role));
  const usedMissions = new Set(Object.values(players).map((p) => p.mission));
  const freeRoles = shuffle(content.roles.filter((role) => !usedRoles.has(role.name)));
  const freeMissions = shuffle(content.missions.filter((mission) => !usedMissions.has(mission)));

  for (const name of content.players) {
    if (players[name]) continue;
    if (!freeRoles.length || !freeMissions.length) throw new Error(`Geen vrije rol of opdracht meer voor ${name}`);
    players[name] = { code: generatePlayerCode(), role: freeRoles.pop().name, mission: freeMissions.pop() };
  }

  const assigned = { ...previous.questions };
  let nextNumber = Math.max(0, ...Object.values(assigned).map((q) => q.number)) + 1;
  for (const question of questions) {
    assigned[question.key] ??= { number: nextNumber++, slug: generateSlug(), pin: generatePin() };
    if (question.anagramOf) assigned[question.key].anagram ??= scramble(question.anagramOf);
  }

  return { players, questions: assigned };
}

export function buildSeedSql(content, questions, assignments) {
  const roleDescriptions = new Map(content.roles.map((role) => [role.name, role.description ?? '']));
  const lines = ['-- Gegenereerd door lustrum/scripts/generate.mjs. Bevat geheimen: niet committen.'];

  for (const name of content.players) {
    const { code, role, mission } = assignments.players[name];
    lines.push(
      `INSERT INTO lustrum_players (name, code, role, role_description, mission) VALUES (${sql(name)}, ${sql(code)}, ${sql(role)}, ${sql(roleDescriptions.get(role) ?? '')}, ${sql(mission)})` +
        ' ON CONFLICT (name) DO UPDATE SET code = excluded.code, role = excluded.role, role_description = excluded.role_description, mission = excluded.mission;',
    );
  }

  for (const question of questions) {
    const { number, slug, pin, anagram } = assignments.questions[question.key];
    const body = question.body.replace('{anagram}', anagram ?? '');
    lines.push(
      `INSERT INTO lustrum_questions (key, number, slug, pin, title, body, answers, points, max_attempts) VALUES (${sql(question.key)}, ${number}, ${sql(slug)}, ${sql(pin)}, ${sql(question.title)}, ${sql(body)}, ${sql(JSON.stringify(question.answers))}, ${question.points}, ${question.maxAttempts ?? 3})` +
        ' ON CONFLICT (key) DO UPDATE SET number = excluded.number, slug = excluded.slug, pin = excluded.pin, title = excluded.title, body = excluded.body, answers = excluded.answers, points = excluded.points, max_attempts = excluded.max_attempts;',
    );
  }
  return `${lines.join('\n')}\n`;
}

export function questionUrl(content, slug) {
  return `${content.baseUrl.replace(/\/$/, '')}/lustrum/${slug}`;
}

/** Husselt de letters (zonder spaties) en zorgt dat het resultaat afwijkt van het origineel. */
export function scramble(text) {
  const letters = text.normalize('NFD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (new Set(letters).size < 2) return letters;
  let result = letters;
  while (result === letters) result = shuffle([...letters]).join('');
  return result;
}

function hasTodo(question) {
  return [question.anagramOf, ...(question.answers ?? [])].some((value) => TODO.test(String(value ?? '')));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
