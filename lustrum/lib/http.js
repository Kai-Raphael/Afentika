export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function readJson(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Ongeldige JSON');
  return body;
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/** Vertaalt HttpErrors naar JSON-responses zodat handlers dun blijven. */
export function withErrors(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: 'Er ging iets mis op de server' }, 500);
    }
  };
}
