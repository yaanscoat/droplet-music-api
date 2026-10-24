import { config } from '../../config.js';
import { TTLCache } from '../../lib/cache.js';
import { getJSON } from '../../lib/http.js';
import { best } from '../../lib/match.js';
import { resolveAudio } from '../../lib/ytdlp.js';
import { mapSong, ytm } from '../ytmusic-client.js';

// googlevideo URLs expire after ~6h; keep them a bit less than that.
const streams = new TTLCache({ ttl: 4 * 60 * 60_000, max: 500 });

export const name = 'ytmusic';

/** Find the YouTube Music song that best matches a track from another catalog. */
export async function match(track) {
  const client = await ytm();
  const query = `${track.artist} ${track.title}`;
  const [songs, videos] = await Promise.all([
    client.searchSongs(query).catch(() => []),
    client.searchVideos(query).catch(() => []),
  ]);
  const candidates = [
    ...songs.slice(0, 8).map((s) => ({ ...mapSong(s), kind: 'song' })),
    // Videos come last so that on a tie the clean song upload wins.
    ...videos.slice(0, 5).map((v) => ({ ...mapSong(v), kind: 'video' })),
  ];
  const hit = best(track, candidates);
  return hit && { provider: name, id: hit.id, title: hit.title, artist: hit.artist, score: hit.score };
}

async function viaInvidious(videoId) {
  const data = await getJSON(`${config.invidious}/api/v1/videos/${videoId}?local=true`);
  const audio = (data.adaptiveFormats || [])
    .filter((f) => f.type?.startsWith('audio/'))
    .sort((a, b) => (a.type.includes('mp4') ? -1 : 1) - (b.type.includes('mp4') ? -1 : 1) || b.bitrate - a.bitrate)[0];
  if (!audio) throw new Error('Invidious returned no audio formats');
  const url = audio.url.startsWith('http') ? audio.url : `${config.invidious}${audio.url}`;
  const mime = audio.type.split(';')[0];
  return { url, headers: {}, mime, ext: mime.includes('webm') ? 'webm' : 'm4a', size: Number(audio.clen) || undefined };
}

/** A direct, range-able audio URL for a YouTube video id. */
export function stream(videoId) {
  return streams.wrap(videoId, async () => {
    try {
      return await resolveAudio(`https://music.youtube.com/watch?v=${videoId}`);
    } catch (err) {
      if (!config.invidious) throw err;
      return viaInvidious(videoId);
    }
  });
}

export function forget(videoId) {
  streams.delete(videoId);
}
