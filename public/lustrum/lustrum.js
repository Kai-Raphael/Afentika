/** Gedeelde helpers voor de lustrumpagina's. */
const PLAYER_CODE_KEY = 'lustrum.playerCode';

export const playerCode = {
  get: () => safely(() => localStorage.getItem(PLAYER_CODE_KEY)) ?? '',
  set: (code) => safely(() => localStorage.setItem(PLAYER_CODE_KEY, code)),
  clear: () => safely(() => localStorage.removeItem(PLAYER_CODE_KEY)),
};

export async function api(path, { token = playerCode.get(), body } = {}) {
  const response = await fetch(`/api/lustrum/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'Er ging iets mis'), { status: response.status });
  return data;
}

/** Klein DOM-hulpje; zet tekst altijd via textContent zodat er geen HTML-injectie kan. */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

export const $ = (selector) => document.querySelector(selector);

export function showMessage(target, text, kind = 'error') {
  target.replaceChildren(text ? el('div', { className: `message ${kind}`, textContent: text }) : '');
}

/** Formulier dat een spelerscode vraagt en valideert via /me. */
export function renderLogin(container, onLoggedIn) {
  const input = el('input', { className: 'code', placeholder: 'ABC123', autocomplete: 'off', maxLength: 8, required: true });
  const feedback = el('div');
  const form = el(
    'form',
    { className: 'card' },
    el('h2', { textContent: 'Log in met je spelerscode' }),
    el('p', { className: 'muted', textContent: 'Die staat in je persoonlijke brief.' }),
    input,
    el('button', { type: 'submit', textContent: 'Inloggen' }),
    feedback,
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const overview = await api('me', { token: input.value.trim() });
      playerCode.set(input.value.trim());
      onLoggedIn(overview);
    } catch (error) {
      showMessage(feedback, error.message);
    }
  });
  container.replaceChildren(form);
  input.focus();
}

function safely(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
