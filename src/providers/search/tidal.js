// Official TIDAL Open API (https://developer.tidal.com). Needs a free client id/secret.
// The API speaks JSON:API, so related resources arrive in an `included` array we index by type+id.
import { config } from '../../config.js';
import { TTLCache } from '../../lib/cache.js';
import { getJSON, request } from '../../lib/http.js';
import { emptyResults, fullTitle, isoDuration } from './tidal-common.js';

export const name = 'tidal';

const API = 'https://openapi.tidal.com/v2';
const cache = new TTLCache({ ttl: 15 * 60_000 });

export const enabled = () => Boolean(config.tidal.clientId && config.tidal.clientSecret);

// ── auth ────────────────────────────────────────────────────────────────────
let token = null;
let tokenExpires = 0;

async function getToken() {
  if (token && Date.now() < tokenExpires) return token;
  const basic = Buffer.from(`${config.tidal.clientId}:${config.tidal.clientSecret}`).toString('base64');
  const res = await request('https://auth.tidal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  token = json.access_token;
  tokenExpires = Date.now() + (json.expires_in - 60) * 1000;
  return token;
}

async function api(path, params = {}) {
  const qs = new URLSearchParams({ countryCode: config.tidal.country, ...params });
  return getJSON(`${API}${path}${path.includes('?') ? '&' : '?'}${qs}`, {
    headers: { authorization: `Bearer ${await getToken()}`, accept: 'application/vnd.api+json' },
  });
}

// ── JSON:API helpers ────────────────────────────────────────────────────────
function index(doc) {
  const map = new Map();
  for (const r of [...(doc.included || []), ...[].concat(doc.data || [])]) map.set(`${r.type}:${r.id}`, r);
  return map;
}

const rel = (resource, key) => [].concat(resource?.relationships?.[key]?.data || []);
const refs = (resource, key, idx) => rel(resource, key).map((r) => idx.get(`${r.type}:${r.id}`)).filter(Boolean);

function artworkUrl(artwork, target = 640) {
  const files = artwork?.attributes?.files || [];
  const sorted = [...files].sort((a, b) => Math.abs((a.meta?.width || 0) - target) - Math.abs((b.meta?.width || 0) - target));
  return sorted[0]?.href || null;
}

/** Fetch many resources of one type by id, 20 at a time, with their relationships included. */
async function batch(type, ids, include) {
  const idx = new Map();
  for (let i = 0; i < ids.length; i += 20) {
    const doc = await api(`/${type}`, { 'filter[id]': ids.slice(i, i + 20).join(','), include });
    for (const [k, v] of index(doc)) idx.set(k, v);
  }
  return idx;
}

// ── mapping ─────────────────────────────────────────────────────────────────
function mapArtist(a, idx) {
  return {
    id: a.id,
    source: 'tidal',
    name: a.attributes?.name || '',
    picture: artworkUrl(refs(a, 'profileArt', idx)[0], 750),
  };
}

function mapAlbum(a, idx) {
  const artists = refs(a, 'artists', idx).map((x) => ({ id: x.id, name: x.attributes?.name, source: 'tidal' }));
  const date = a.attributes?.releaseDate || null;
  return {
    id: a.id,
    source: 'tidal',
    title: a.attributes?.title || '',
    artist: artists.map((x) => x.name).join(', '),
    artists,
    year: date ? Number(date.slice(0, 4)) : null,
    releaseDate: date,
    cover: artworkUrl(refs(a, 'coverArt', idx)[0]),
    trackCount: a.attributes?.numberOfItems ?? null,
    type: a.attributes?.type || 'ALBUM',
  };
}

function mapTrack(t, idx, albumOverride) {
  const artists = refs(t, 'artists', idx).map((x) => ({ id: x.id, name: x.attributes?.name, source: 'tidal' }));
  const album = albumOverride || (refs(t, 'albums', idx)[0] && mapAlbum(refs(t, 'albums', idx)[0], idx));
  return {
    id: t.id,
    source: 'tidal',
    title: fullTitle(t.attributes?.title || '', t.attributes?.version),
    artist: artists.map((x) => x.name).join(', ') || album?.artist || '',
    artists: artists.length ? artists : album?.artists || [],
    album: album ? { id: album.id, title: album.title } : null,
    duration: isoDuration(t.attributes?.duration),
    cover: album?.cover || null,
    explicit: !!t.attributes?.explicit,
    isrc: t.attributes?.isrc || null,
  };
}

/** Hydrate bare track ids with artists + album covers. */
async function hydrateTracks(ids, albumOverride) {
  if (!ids.length) return [];
  const idx = await batch('tracks', ids, albumOverride ? 'artists' : 'artists,albums');
  if (!albumOverride) {
    const albumIds = [...new Set([...idx.values()].filter((r) => r.type === 'tracks').flatMap((t) => rel(t, 'albums').map((r) => r.id)))];
    for (const [k, v] of await batch('albums', albumIds, 'coverArt,artists')) idx.set(k, v);
  }
  return ids.map((id) => idx.get(`tracks:${id}`)).filter(Boolean).map((t) => mapTrack(t, idx, albumOverride));
}

async function hydrateAlbums(ids) {
  if (!ids.length) return [];
  const idx = await batch('albums', ids, 'coverArt,artists');
  return ids.map((id) => idx.get(`albums:${id}`)).filter(Boolean).map((a) => mapAlbum(a, idx));
}

async function hydrateArtists(ids) {
  if (!ids.length) return [];
  const idx = await batch('artists', ids, 'profileArt');
  return ids.map((id) => idx.get(`artists:${id}`)).filter(Boolean).map((a) => mapArtist(a, idx));
}

// ── API ─────────────────────────────────────────────────────────────────────
export function search(q, { limit = 20 } = {}) {
  return cache.wrap(`search:${q}:${limit}`, async () => {
    const doc = await api(`/searchResults/${encodeURIComponent(q)}`, { include: 'tracks,albums,artists' });
    const ids = (key, n) => rel(doc.data, key).slice(0, n).map((r) => r.id);
    const [tracks, albums, artists] = await Promise.all([
      hydrateTracks(ids('tracks', limit)),
      hydrateAlbums(ids('albums', 12)),
      hydrateArtists(ids('artists', 10)),
    ]);
    return { ...emptyResults(), tracks, albums, artists };
  });
}

export function album(id) {
  return cache.wrap(`album:${id}`, async () => {
    const doc = await api(`/albums/${id}`, { include: 'coverArt,artists,items' });
    const idx = index(doc);
    const meta = mapAlbum(doc.data, idx);
    let trackIds = rel(doc.data, 'items').filter((r) => r.type === 'tracks').map((r) => r.id);
    // Albums with more than one page of items link to the rest.
    let next = doc.data.relationships?.items?.links?.next;
    while (next && trackIds.length < 300) {
      const page = await getJSON(new URL(next, API + '/').href, {
        headers: { authorization: `Bearer ${await getToken()}`, accept: 'application/vnd.api+json' },
      });
      trackIds = trackIds.concat([].concat(page.data || []).filter((r) => r.type === 'tracks').map((r) => r.id));
      next = page.links?.next;
    }
    return { album: meta, tracks: await hydrateTracks(trackIds, meta) };
  });
}

export function artist(id) {
  return cache.wrap(`artist:${id}`, async () => {
    const doc = await api(`/artists/${id}`, { include: 'profileArt,albums,tracks,similarArtists' });
    const idx = index(doc);
    const albumIds = rel(doc.data, 'albums').map((r) => r.id);
    const [albums, topTracks, similar] = await Promise.all([
      hydrateAlbums(albumIds.slice(0, 40)),
      hydrateTracks(rel(doc.data, 'tracks').slice(0, 10).map((r) => r.id)),
      hydrateArtists(rel(doc.data, 'similarArtists').slice(0, 12).map((r) => r.id)),
    ]);
    const byDate = (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '');
    return {
      artist: mapArtist(doc.data, idx),
      topTracks,
      albums: albums.filter((a) => a.type === 'ALBUM').sort(byDate),
      singles: albums.filter((a) => a.type !== 'ALBUM').sort(byDate),
      similar,
    };
  });
}
