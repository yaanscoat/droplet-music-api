import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const env = process.env;

function list(value, fallback) {
  const items = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

export const ROOT = resolve(import.meta.dirname, '..');
export const DATA_DIR = resolve(ROOT, env.DATA_DIR || 'data');
export const CACHE_DIR = join(DATA_DIR, 'cache');

function findYtDlp() {
  if (env.YT_DLP_PATH) return env.YT_DLP_PATH;
  const local = join(ROOT, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return existsSync(local) ? local : 'yt-dlp';
}

export const config = {
  port: Number(env.PORT) || 2010,
  host: env.HOST || '0.0.0.0',

  searchProviders: list(env.SEARCH_PROVIDERS, ['tidal', 'monochrome', 'ytmusic']),
  playbackProviders: list(env.PLAYBACK_PROVIDERS, ['ytmusic', 'soundcloud']),

  tidal: {
    clientId: env.TIDAL_CLIENT_ID || '',
    clientSecret: env.TIDAL_CLIENT_SECRET || '',
    country: env.TIDAL_COUNTRY || 'US',
  },

  // Monochrome's community hifi-api instances. They come and go; override with MONOCHROME_INSTANCES.
  monochrome: {
    instances: list(env.MONOCHROME_INSTANCES, [
      'https://eu-central.monochrome.tf',
      'https://us-west.monochrome.tf',
      'https://arran.monochrome.tf',
      'https://api.monochrome.tf',
      'https://wolf.qqdl.site',
      'https://maus.qqdl.site',
      'https://vogel.qqdl.site',
      'https://hund.qqdl.site',
      'https://katze.qqdl.site',
      'https://tidal.kinoplus.online',
    ]).map((u) => u.replace(/\/+$/, '')),
  },

  ytDlpPath: findYtDlp(),
  invidious: (env.INVIDIOUS_INSTANCE || '').replace(/\/+$/, ''),
  soundcloudClientId: env.SOUNDCLOUD_CLIENT_ID || '',
};
