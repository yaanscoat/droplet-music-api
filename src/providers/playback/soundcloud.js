import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, config } from '../../config.js';
import { TTLCache } from '../../lib/cache.js';
import { getJSON, getText, HttpError, request } from '../../lib/http.js';
import { best } from '../../lib/match.js';

const API = 'https://api-v2.soundcloud.com';
const streams = new TTLCache({ ttl: 20 * 60_000, max: 500 });
const tracks = new TTLCache({ ttl: 60 * 60_000, max: 1000 });

export const name = 'soundcloud';

// ── client id ────────────────────────────────────────────────────────────────
let clientId = config.soundcloudClientId || null;
let clientIdPromise = null;

/** SoundCloud's web app ships a public client id in its JS bundles; scrape it. */
async function getClientId(refresh = false) {
  if (clientId && !refresh) return clientId;
  clientIdPromise ??= (async () => {
    const html = await getText('https://soundcloud.com/');
    const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)]
      .map((m) => m[1])
      .reverse();
    for (const src of scripts) {
      const js = await getText(src).catch(() => '');
      const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/);
      if (m) return (clientId = m[1]);
    }
    throw new Error('Could not find a SoundCloud client_id');
  })().finally(() => (clientIdPromise = null));
  return clientIdPromise;
}

async function api(path, params = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await getClientId(attempt > 0);
    const qs = new URLSearchParams({ ...params, client_id: id });
    try {
      return await getJSON(`${path.startsWith('http') ? path : API + path}${path.includes('?') ? '&' : '?'}${qs}`);
    } catch (err) {
      // A stale client id answers 401/403: scrape a fresh one and retry once.
      if (attempt === 0 && err instanceof HttpError && (err.status === 401 || err.status === 403)) continue;
      throw err;
    }
  }
}

// ── mapping ──────────────────────────────────────────────────────────────────
const art = (url) => url?.replace('-large.', '-t500x500.') || null;

export function mapTrack(t) {
  const meta = t.publisher_metadata || {};
  tracks.set(String(t.id), t);
  return {
    id: String(t.id),
    source: 'soundcloud',
    title: t.title,
    artist: meta.artist || t.user?.username || '',
    artists: [{ id: String(t.user?.id ?? ''), name: meta.artist || t.user?.username || '', source: 'soundcloud' }],
    album: meta.album_title ? { id: null, title: meta.album_title } : null,
    duration: Math.round((t.full_duration || t.duration || 0) / 1000) || null,
    cover: art(t.artwork_url || t.user?.avatar_url),
    explicit: !!meta.explicit,
    isrc: meta.isrc || null,
    url: t.permalink_url,
    preview: t.policy === 'SNIP',
  };
}

// ── search / match ───────────────────────────────────────────────────────────
export async function searchTracks(q, limit = 20) {
  const data = await api('/search/tracks', { q, limit });
  return (data.collection || []).filter((t) => t.kind === 'track').map(mapTrack);
}

export async function match(track) {
  const results = (await searchTracks(`${track.artist} ${track.title}`, 15)).filter((t) => !t.preview);
  const hit = best(track, results);
  return hit && { provider: name, id: hit.id, title: hit.title, artist: hit.artist, score: hit.score };
}

// ── streaming ────────────────────────────────────────────────────────────────
async function getTrack(id) {
  return tracks.get(id) || api(`/tracks/${id}`);
}

async function transcodingUrl(t, transcoding) {
  const params = t.track_authorization ? { track_authorization: t.track_authorization } : {};
  return (await api(transcoding.url, params)).url;
}

/**
 * Download an HLS stream into one file so it can be served with Range support.
 * MP3 segments simply concatenate; AAC streams are fragmented MP4 and need their init segment first.
 */
async function downloadHls(playlistUrl, file) {
  const m3u8 = await getText(playlistUrl);
  const lines = m3u8.split('\n').map((l) => l.trim());
  const abs = (u) => new URL(u, playlistUrl).href;
  const init = lines.map((l) => /^#EXT-X-MAP:.*URI="([^"]+)"/.exec(l)?.[1]).find(Boolean);
  const segments = [...(init ? [init] : []), ...lines.filter((l) => l && !l.startsWith('#'))].map(abs);
  const chunks = new Array(segments.length);
  let next = 0;
  const worker = async () => {
    while (next < segments.length) {
      const i = next++;
      chunks[i] = Buffer.from(await (await request(segments[i], { timeout: 30_000 })).arrayBuffer());
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  await mkdir(CACHE_DIR, { recursive: true });
  const tmp = `${file}.part`;
  await new Promise((resolve, reject) => {
    const out = createWriteStream(tmp);
    out.on('error', reject).on('finish', resolve);
    for (const c of chunks) out.write(c);
    out.end();
  });
  await rename(tmp, file);
}

/**
 * Either `{ url, mime }` for a direct progressive stream, or `{ file, mime }` for a locally cached copy.
 */
export function stream(id) {
  return streams.wrap(id, async () => {
    const cached = [
      { file: join(CACHE_DIR, `soundcloud-${id}.mp3`), mime: 'audio/mpeg', ext: 'mp3' },
      { file: join(CACHE_DIR, `soundcloud-${id}.m4a`), mime: 'audio/mp4', ext: 'm4a' },
    ];
    for (const c of cached) if (await stat(c.file).then((s) => s.size > 0, () => false)) return c;

    const t = await getTrack(id);
    const list = t.media?.transcodings || [];
    const find = (protocol, mime, preset) =>
      list.find((x) => x.format?.protocol === protocol && x.format.mime_type.startsWith(mime) && (!preset || x.preset?.startsWith(preset)));

    const progressive = find('progressive', 'audio/mpeg');
    if (progressive) {
      return { url: await transcodingUrl(t, progressive), headers: {}, mime: 'audio/mpeg', ext: 'mp3' };
    }
    const mp3 = find('hls', 'audio/mpeg');
    if (mp3 && !mp3.format.mime_type.includes('mpegurl')) {
      await downloadHls(await transcodingUrl(t, mp3), cached[0].file);
      return cached[0];
    }
    const aac = find('hls', 'audio/mp4', 'aac_160k') || find('hls', 'audio/mp4');
    if (aac) {
      await downloadHls(await transcodingUrl(t, aac), cached[1].file);
      return cached[1];
    }
    throw Object.assign(new Error('No playable SoundCloud stream for this track'), { status: 404 });
  });
}

export function forget(id) {
  streams.delete(id);
}
