// Thin client for the backend in src/routes.

async function call(path, init) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

const enc = encodeURIComponent;

/** Query string that identifies a track for /api/resolve, /api/stream and /api/download. */
export function trackQuery(t) {
  const q = new URLSearchParams({ source: t.source, id: t.id });
  if (t.title) q.set('title', t.title);
  if (t.artist) q.set('artist', t.artist);
  if (t.duration) q.set('duration', String(t.duration));
  return q.toString();
}

export const streamUrl = (t) => `/api/stream?${trackQuery(t)}`;
export const downloadUrl = (t) => `/api/download?${trackQuery(t)}`;

export const api = {
  search: (q, source) => call(`/api/search?q=${enc(q)}${source ? `&source=${enc(source)}` : ''}`),
  suggest: (q) => call(`/api/suggest?q=${enc(q)}`),
  home: () => call('/api/home'),
  album: (source, id) => call(`/api/album/${source}/${enc(id)}`),
  artist: (source, id) => call(`/api/artist/${source}/${enc(id)}`),
  playlist: (id) => call(`/api/playlist/${enc(id)}`),
  status: () => call('/api/status'),

  resolve: (t, warm = false) => call(`/api/resolve?${trackQuery(t)}${warm ? '&warm=1' : ''}`),
  unmatch: (t) => call(`/api/resolve?${trackQuery(t)}`, { method: 'DELETE' }),

  likes: () => call('/api/library/likes'),
  like: (t) =>
    call('/api/library/likes', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(t) }),
  unlike: (t) => call(`/api/library/likes/${t.source}/${enc(t.id)}`, { method: 'DELETE' }),
};
