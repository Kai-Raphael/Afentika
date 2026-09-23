import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assign, buildSeedSql, scramble, validateContent } from '../scripts/game-builder.js';
import { createTestDb } from './d1.js';

const example = () => JSON.parse(readFileSync(new URL('../content/game.example.json', import.meta.url), 'utf8'));

describe('validateContent', () => {
  it('refuses TODO answers unless explicitly skipped', () => {
    expect(validateContent(example()).errors).toEqual([expect.stringContaining('oprichting')]);

    const { errors, questions } = validateContent(example(), { skipTodo: true });
    expect(errors).toEqual([]);
    expect(questions.map((q) => q.key)).toEqual(['kaart', 'adres']);
  });

  it('refuses placeholder player names and invalid attempt limits', () => {
    const content = example();
    content.players[0] = 'TODO speler 1';
    content.questions[0].maxAttempts = 0;
    expect(validateContent(content, { skipTodo: true }).errors).toEqual([
      'players bevat nog TODO-namen',
      'Vraag "kaart": maxAttempts moet een positief geheel getal zijn',
    ]);
  });

  it('requires a role and mission for every player', () => {
    const content = { ...example(), players: ['A', 'B', 'C', 'D'] };
    expect(validateContent(content, { skipTodo: true }).errors).toEqual([
      'Minder rollen dan spelers',
      'Minder opdrachten dan spelers',
    ]);
  });
});

describe('assign', () => {
  it('gives every player a unique role and mission', () => {
    const content = example();
    const { players } = assign(content, validateContent(content, { skipTodo: true }).questions);
    expect(new Set(Object.values(players).map((p) => p.role)).size).toBe(3);
    expect(new Set(Object.values(players).map((p) => p.mission)).size).toBe(3);
  });

  it('keeps earlier codes stable so printed stickers stay valid', () => {
    const content = example();
    const { questions } = validateContent(content, { skipTodo: true });
    const first = assign(content, questions.slice(0, 1));
    const second = assign(content, questions, first);

    expect(second.players).toEqual(first.players);
    expect(second.questions.kaart).toEqual(first.questions.kaart);
    expect(second.questions.adres.number).toBe(2);
  });
});

describe('buildSeedSql', () => {
  it('produces SQL that loads into the schema and can be re-run', () => {
    const content = { ...example(), players: ["Speler O'Neill", 'Speler Twee', 'Speler Drie'] };
    const { questions } = validateContent(content, { skipTodo: true });
    const seed = buildSeedSql(content, questions, assign(content, questions));

    const db = createTestDb();
    db.sqlite.exec(seed);
    db.sqlite.exec(seed);

    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM lustrum_players').get().n).toBe(3);
    const adres = db.sqlite.prepare("SELECT body FROM lustrum_questions WHERE key = 'adres'").get();
    expect(adres.body).not.toContain('{anagram}');
  });
});

describe('scramble', () => {
  it('keeps the letters but changes the order', () => {
    const result = scramble('Voorbeeld straat');
    expect(result).not.toBe('VOORBEELDSTRAAT');
    expect([...result].sort()).toEqual([...'VOORBEELDSTRAAT'].sort());
  });
});
