const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LENGTH = 24; // 36^24 is ruim 2^124 mogelijkheden: niet te raden.
const PIN_ALPHABET = '0123456789';
const PIN_LENGTH = 4;
// Zonder 0/O, 1/I/L zodat codes van papier makkelijk over te typen zijn.
const PLAYER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PLAYER_CODE_LENGTH = 6;

const QUESTION_SLUG = new RegExp(`^[a-z0-9]{${SLUG_LENGTH}}$`);

/** Uniform willekeurige string; rejection sampling voorkomt modulo-bias. */
export function randomString(alphabet, length) {
  const limit = 256 - (256 % alphabet.length);
  let result = '';
  while (result.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && result.length < length) result += alphabet[byte % alphabet.length];
    }
  }
  return result;
}

export const generateSlug = () => randomString(SLUG_ALPHABET, SLUG_LENGTH);
export const generatePin = () => randomString(PIN_ALPHABET, PIN_LENGTH);
export const generatePlayerCode = () => randomString(PLAYER_CODE_ALPHABET, PLAYER_CODE_LENGTH);

export const isQuestionSlug = (value) => QUESTION_SLUG.test(value);

export function normalizePlayerCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
