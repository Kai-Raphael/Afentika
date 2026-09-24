// Stuurt afentika.nl/lustrum/* door naar het lustrumspel op de VPS
// (Django + React, repo operatie-afentika). De rest van de site blijft Pages.
const ORIGIN = 'lustrum-origin.afentika.nl';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  url.hostname = ORIGIN;
  url.protocol = 'https:';
  url.port = '';

  const upstream = new Request(url, request);
  upstream.headers.set('X-Forwarded-Host', new URL(request.url).host);

  // redirect: 'manual' zodat redirects (bv. admin-login) bij de browser aankomen.
  return fetch(upstream, { redirect: 'manual' });
}
