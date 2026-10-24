// Monochrome (https://github.com/monochrome-music/monochrome) talks to Tidal through community
// "hifi-api" instances. This provider uses the same instances with failover between them.
import { config } from '../../config.js';
import { TTLCache } from '../../lib/cache.js';
import { getJSON } from '../../lib/http.js';
import { emptyResults, fullTitle, tidalImage } from './tidal-common.js';

export const name = 'monochrome';

const cache = new TTLCache({ ttl: 15 * 60_000 });
const dead = new Map(); // instance -> retry-after timestamp
let preferred = 0;

export const enabled = () => config.monochrome.instances.length > 0;

/** GET a path from the first healthy instance, falling over to the next on error. */
async function call(path) {
  const list = config.monochrome.instances;
  const errors = [];
  for (let i = 0; i < list.length; i++) {
    const idx = (preferred + i) % list.length;
    const base = list[idx];
    if ((dead.get(base) || 0) > Date.now()) continue;
    try {
      const json = await getJSON(base + path, { timeout: 8_000 });
      preferred = idx;
      return json?.data ?? json;
    } catch (err) {
      // 4xx means the instance is alive but the request is bad; don't blacklist it for that.
      if (!(err.status >= 400 && err.status < 500 && err.status !== 429)) dead.set(base, Date.now() + 10 * 60_000);
      errors.push(`${new URL(base).host}: ${err.message}`);
    }
  }
  throw new Error(errors.length ? `All Monochrome instances failed (${errors.slice(0, 3).join('; ')})` : 'No live Monochrome instances (retrying in a few minutes)');
}

const itemsOf = (data, key) => data?.items ?? data?.[key]?.items ?? data?.data?.items ?? [];

// ── mapping (Tidal v1 JSON) ─────────────────────────────────────────────────
const mapArtistRef = (a) => ({ id: String(a.id), name: a.name, source: 'tidal' });

export function mapTrack(t, album) {
  const artists = (t.artists?.length ? t.artists : t.artist ? [t.artist] : []).map(mapArtistRef);
  const al = t.album || album;
  return {
    id: String(t.id),
    source: 'tidal',
    title: fullTitle(t.title, t.version),
    artist: artists.map((a) => a.name).join(', '),
    artists,
    album: al ? { id: String(al.id), title: al.title } : null,
    duration: t.duration || null,
    cover: tidalImage(al?.cover),
    explicit: !!t.explicit,
    isrc: t.isrc || null,
    trackNumber: t.trackNumber,
  };
}

export function mapAlbum(a) {
  const artists = (a.artists?.length ? a.artists : a.artist ? [a.artist] : []).map(mapArtistRef);
  return {
    id: String(a.id),
    source: 'tidal',
    title: a.title,
    artist: artists.map((x) => x.name).join(', '),
    artists,
    year: a.releaseDate ? Number(a.releaseDate.slice(0, 4)) : null,
    releaseDate: a.releaseDate || null,
    cover: tidalImage(a.cover),
    trackCount: a.numberOfTracks ?? null,
    type: a.type || 'ALBUM',
  };
}

export function mapArtist(a) {
  return { id: String(a.id), source: 'tidal', name: a.name, picture: tidalImage(a.picture, 750) };
}

// ── API ─────────────────────────────────────────────────────────────────────
export function search(q, { limit = 20 } = {}) {
  return cache.wrap(`search:${q}:${limit}`, async () => {
    const enc = encodeURIComponent(q);
    const [tracks, albums, artists] = await Promise.allSettled([
      call(`/search/?s=${enc}&limit=${limit}`),
      call(`/search/?al=${enc}&limit=12`),
      call(`/search/?a=${enc}&limit=10`),
    ]);
    if (tracks.status === 'rejected' && albums.status === 'rejected') throw tracks.reason;
    const out = emptyResults();
    if (tracks.status === 'fulfilled') out.tracks = itemsOf(tracks.value, 'tracks').map((t) => mapTrack(t));
    if (albums.status === 'fulfilled') out.albums = itemsOf(albums.value, 'albums').map(mapAlbum);
    if (artists.status === 'fulfilled') out.artists = itemsOf(artists.value, 'artists').map(mapArtist);
    return out;
  });
}

export function album(id) {
  return cache.wrap(`album:${id}`, async () => {
    const data = await call(`/album/?id=${encodeURIComponent(id)}&limit=200`);
    const raw = data.album ?? data;
    const meta = mapAlbum(raw);
    const items = (data.items ?? raw.items ?? []).map((x) => x.item ?? x).filter((x) => x && x.title);
    return { album: meta, tracks: items.map((t) => mapTrack(t, raw)) };
  });
}

export function artist(id) {
  return cache.wrap(`artist:${id}`, async () => {
    const enc = encodeURIComponent(id);
    const [info, releases, similar] = await Promise.allSettled([
      call(`/artist/?id=${enc}`),
      call(`/artist/?f=${enc}`),
      call(`/artist/similar/?id=${enc}`),
    ]);
    if (info.status === 'rejected') throw info.reason;
    const a = info.value.artist ?? info.value;
    const rel = releases.status === 'fulfilled' ? releases.value : {};
    const albums = itemsOf(rel, 'albums').map(mapAlbum);
    return {
      artist: { ...mapArtist(a), picture: info.value.cover?.['750'] || tidalImage(a.picture, 750) },
      topTracks: (rel.tracks ?? []).slice(0, 10).map((t) => mapTrack(t)),
      albums: albums.filter((x) => x.type !== 'SINGLE' && x.type !== 'EP'),
      singles: albums.filter((x) => x.type === 'SINGLE' || x.type === 'EP'),
      similar: similar.status === 'fulfilled' ? (similar.value.artists ?? []).map(mapArtist) : [],
    };
  });
}
