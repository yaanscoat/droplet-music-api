export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** fetch() with a timeout, a browser user agent and a readable error on non-2xx responses. */
export async function request(url, { timeout = 12_000, headers = {}, ...init } = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': USER_AGENT, ...headers },
    signal: init.signal ?? AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} from ${new URL(url).host}`);
  return res;
}

export async function getJSON(url, opts) {
  const res = await request(url, opts);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) {
    throw new HttpError(502, `Expected JSON from ${new URL(url).host}, got ${type || 'nothing'}`);
  }
  return res.json();
}

export async function getText(url, opts) {
  return (await request(url, opts)).text();
}
