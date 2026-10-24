import { join } from 'node:path';
import { config, DATA_DIR } from '../../config.js';
import { JsonStore } from '../../lib/store.js';
import * as soundcloud from './soundcloud.js';
import * as ytmusic from './youtube-music.js';

const providers = { ytmusic, soundcloud };

// Remember which YouTube/SoundCloud upload a catalog track was matched to, across restarts.
const matches = new JsonStore(join(DATA_DIR, 'matches.json'), {});

/**
 * Work out where a track's audio comes from.
 * Tracks that already come from a playback source play directly; anything else
 * (Tidal/Monochrome results) is matched against YouTube Music, then SoundCloud.
 * @param {{source:string, id:string, title?:string, artist?:string, duration?:number}} track
 * @returns {Promise<{provider:string, id:string, title?:string, artist?:string, score?:number}>}
 */
export async function resolve(track, { skip = [] } = {}) {
  if (providers[track.source]) return { provider: track.source, id: track.id };

  const key = `${track.source}:${track.id}`;
  const saved = (await matches.load())[key];
  if (saved && !skip.includes(saved.provider)) return saved;

  if (!track.title) throw Object.assign(new Error('title and artist are needed to match this track'), { status: 400 });

  const errors = [];
  for (const p of config.playbackProviders) {
    if (!providers[p] || skip.includes(p)) continue;
    try {
      const hit = await providers[p].match(track);
      if (hit) {
        await matches.update((m) => void (m[key] = hit));
        return hit;
      }
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }
  const error = new Error(`No playable match found${errors.length ? ` (${errors.join('; ')})` : ''}`);
  error.status = 404;
  throw error;
}

/** Direct stream info for a resolved match. */
export function stream({ provider, id }) {
  const p = providers[provider];
  if (!p) throw Object.assign(new Error(`Unknown playback provider: ${provider}`), { status: 400 });
  return p.stream(id);
}

export function forget({ provider, id }) {
  providers[provider]?.forget(id);
}

/** Drop a remembered match, e.g. when the user reports a wrong song. */
export function unmatch(track) {
  return matches.update((m) => void delete m[`${track.source}:${track.id}`]);
}
