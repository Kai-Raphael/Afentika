import { describe, expect, it } from 'vitest';
import { generatePin, generatePlayerCode, generateSlug, isQuestionSlug, normalizePlayerCode, randomString } from '../lib/codes.js';

describe('codes', () => {
  it('generates slugs that the router recognises', () => {
    const slug = generateSlug();
    expect(isQuestionSlug(slug)).toBe(true);
    expect(isQuestionSlug('admin')).toBe(false);
    expect(isQuestionSlug('scorebord')).toBe(false);
  });

  it('generates 4 digit pins and unambiguous player codes', () => {
    expect(generatePin()).toMatch(/^\d{4}$/);
    expect(generatePlayerCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });

  it('only uses characters from the alphabet', () => {
    expect(randomString('ab', 200)).toMatch(/^[ab]{200}$/);
  });

  it('normalizes typed player codes', () => {
    expect(normalizePlayerCode(' abc-12x ')).toBe('ABC12X');
  });
});
