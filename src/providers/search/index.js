import { config } from '../../config.js';
import * as soundcloud from '../playback/soundcloud.js';
import * as monochrome from './monochrome.js';
import * as tidal from './tidal.js';
import { emptyResults } from './tidal-common.js';
import * as ytmusic from './ytmusic.js';

// SoundCloud can be searched too, but only has tracks.
const soundcloudSearch = {
  name: 'soundcloud',
  enabled: () => true,
  // Full uploads first; major-label 30 second previews sink to the bottom.
  search: async (q) => ({
    ...emptyResults(),
    tracks: (await soundcloud.searchTracks(q, 30)).sort((a, b) => a.preview - b.preview),
  }),
};

export const providers = { tidal, monochrome, ytmusic, soundcloud: soundcloudSearch };

const ordered = (only) =>
  (only ? [only] : config.searchProviders).map((n) => providers[n]).filter((p) => p?.enabled());

/**
 * Search the configured providers in order and return the first non-empty answer.
 * @param {string} q
 * @param {{source?: string}} opts  pin a single provider
 */
export async function search(q, { source } = {}) {
  const errors = [];
  for (const p of ordered(source)) {
    try {
      const res = await p.search(q);
      if (res.tracks.length || res.albums.length || res.artists.length) return { provider: p.name, ...res, errors };
    } catch (err) {
      errors.push({ provider: p.name, error: err.message });
    }
  }
  return { provider: null, ...emptyResults(), errors };
}

// Tidal and Monochrome share Tidal's id space: try the official API first, then Monochrome.
const catalogFor = (source) => (source === 'tidal' ? [tidal, monochrome] : [providers[source]]).filter((p) => p?.enabled() && p.album);

async function fromCatalog(source, method, id) {
  const errors = [];
  for (const p of catalogFor(source)) {
    try {
      return await p[method](id);
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`);
    }
  }
  const error = new Error(errors.join('; ') || `No catalog for source "${source}"`);
  error.status = errors.length ? 502 : 400;
  throw error;
}

export const album = (source, id) => fromCatalog(source, 'album', id);
export const artist = (source, id) => fromCatalog(source, 'artist', id);
export const playlist = (id) => ytmusic.playlist(id);
export const home = () => ytmusic.home();
export const suggestions = (q) => ytmusic.suggestions(q);

export function status() {
  return Object.fromEntries(Object.entries(providers).map(([n, p]) => [n, p.enabled()]));
}
