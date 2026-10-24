import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import * as playback from '../providers/playback/index.js';

// YouTube throttles large single range requests, so upstream audio is fetched in chunks.
const CHUNK = 4 * 1024 * 1024;

function trackFrom(query) {
  const { source, id, title, artist } = query;
  if (!source || !id) throw Object.assign(new Error('source and id are required'), { status: 400 });
  return { source: String(source), id: String(id), title, artist, duration: Number(query.duration) || undefined };
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m) return null;
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
  if (Number.isNaN(start) || start < 0) start = 0;
  end = Math.min(end, size - 1);
  return start <= end ? { start, end } : null;
}

function safeName(text) {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 150) || 'track';
}

function setCommonHeaders(reply, info, opts) {
  reply.header('content-type', info.mime || 'audio/mp4');
  reply.header('accept-ranges', 'bytes');
  reply.header('cache-control', 'no-store');
  if (opts.download) {
    const name = `${safeName(opts.filename)}.${info.ext || 'm4a'}`;
    const ascii = name.replace(/[^\x20-\x7e]/g, '_');
    reply.header('content-disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
}

async function sendFile(req, reply, info, opts) {
  const { size } = await stat(info.file);
  const range = !opts.download && parseRange(req.headers.range, size);
  setCommonHeaders(reply, info, opts);
  if (range) {
    reply.code(206).header('content-range', `bytes ${range.start}-${range.end}/${size}`);
    reply.header('content-length', range.end - range.start + 1);
    return reply.send(createReadStream(info.file, range));
  }
  reply.header('content-length', size);
  return reply.send(createReadStream(info.file));
}

async function fetchRange(info, start, end, signal) {
  const res = await fetch(info.url, {
    headers: { ...info.headers, range: `bytes=${start}-${end ?? ''}` },
    signal,
  });
  if (!res.ok) throw Object.assign(new Error(`Upstream audio returned ${res.status}`), { status: res.status });
  return res;
}

/** Proxy a remote audio URL, honouring the client's Range header. */
async function sendRemote(req, reply, info, opts) {
  const abort = new AbortController();
  req.raw.on('close', () => abort.abort());

  const wanted = opts.download ? null : /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start = wanted ? Number(wanted[1]) : 0;

  // The first chunk tells us the total size if yt-dlp didn't.
  const firstEnd = wanted?.[2] ? Math.min(Number(wanted[2]), start + CHUNK - 1) : start + CHUNK - 1;
  const first = await fetchRange(info, start, firstEnd, abort.signal);
  const total = Number(first.headers.get('content-range')?.split('/')[1]) || info.size || null;
  const end = total ? (wanted?.[2] ? Math.min(Number(wanted[2]), total - 1) : total - 1) : null;

  async function* body() {
    for await (const c of first.body) yield c;
    if (end == null) return;
    for (let pos = Math.min(firstEnd, end) + 1; pos <= end; pos += CHUNK) {
      const res = await fetchRange(info, pos, Math.min(pos + CHUNK - 1, end), abort.signal);
      for await (const c of res.body) yield c;
    }
  }

  setCommonHeaders(reply, info, opts);
  if (end != null) reply.header('content-length', end - start + 1);
  if (wanted && total) reply.code(206).header('content-range', `bytes ${start}-${end}/${total}`);
  const stream = Readable.from(body());
  stream.on('error', () => {}); // client went away or upstream hiccup mid-stream; nothing more to do
  return reply.send(stream);
}

async function serve(req, reply, opts) {
  const track = trackFrom(req.query);
  const match = await playback.resolve(track);
  opts.filename ??= [track.artist || match.artist, track.title || match.title].filter(Boolean).join(' - ');

  for (let attempt = 0; ; attempt++) {
    const info = await playback.stream(match);
    try {
      return info.file ? await sendFile(req, reply, info, opts) : await sendRemote(req, reply, info, opts);
    } catch (err) {
      // Signed URLs expire; get a fresh one once.
      if (attempt === 0 && (err.status === 403 || err.status === 410)) {
        playback.forget(match);
        continue;
      }
      throw err;
    }
  }
}

export default async function streamRoutes(app) {
  /** Which upload a track plays from. `?warm=1` also pre-resolves the audio URL (for gapless "next up"). */
  app.get('/api/resolve', async (req) => {
    const match = await playback.resolve(trackFrom(req.query));
    if (req.query.warm) playback.stream(match).catch(() => {});
    return match;
  });

  /** Forget a wrong match so the next play searches again. */
  app.delete('/api/resolve', async (req) => {
    await playback.unmatch(trackFrom(req.query));
    return { ok: true };
  });

  app.get('/api/stream', (req, reply) => serve(req, reply, { download: false }));

  app.get('/api/download', (req, reply) =>
    serve(req, reply, { download: true, filename: req.query.filename ? String(req.query.filename) : undefined }),
  );
}
