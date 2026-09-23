const LEADING_ARTICLE = /^(de|het|een|'t)\s+/;

/**
 * Brengt een antwoord terug tot kleine letters en cijfers, zodat
 * "De Handdoek!", "handdoek" en "hand-doek" als hetzelfde tellen.
 */
export function normalizeAnswer(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(LEADING_ARTICLE, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isCorrectAnswer(given, acceptedAnswers) {
  const normalized = normalizeAnswer(given);
  if (!normalized) return false;
  return acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized);
}
