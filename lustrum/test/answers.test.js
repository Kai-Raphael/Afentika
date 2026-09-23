import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, normalizeAnswer } from '../lib/answers.js';

describe('normalizeAnswer', () => {
  it.each([
    ['De Handdoek!', 'handdoek'],
    ['  het   gat ', 'gat'],
    ['Afentiká', 'afentika'],
    ['12-03-2011', '12032011'],
    ['€0,15', '015'],
    [null, ''],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeAnswer(raw)).toBe(expected);
  });

  it('only strips a leading article, not one inside the answer', () => {
    expect(normalizeAnswer('Pieter de Grote')).toBe('pieterdegrote');
  });
});

describe('isCorrectAnswer', () => {
  it('accepts any of the listed variants', () => {
    expect(isCorrectAnswer('Kaart', ['landkaart', 'kaart'])).toBe(true);
  });

  it('rejects wrong and empty answers', () => {
    expect(isCorrectAnswer('fiets', ['kaart'])).toBe(false);
    expect(isCorrectAnswer('   ', [''])).toBe(false);
  });
});
