// YouTube Music as a catalog. Used as the out-of-the-box fallback when Tidal/Monochrome are unavailable,
// and for the home feed.
import { TTLCache } from '../../lib/cache.js';
import { mapAlbum, mapArtist, mapPlaylist, mapSong, ytm } from '../ytmusic-client.js';
import { emptyResults } from './tidal-common.js';

export const name = 'ytmusic';
export const enabled = () => true;

const cache = new TTLCache({ ttl: 15 * 60_000 });

export function search(q) {
  return cache.wrap(`search:${q}`, async () => {
    const c = await ytm();
    const [songs, albums, artists, playlists] = await Promise.allSettled([
      c.searchSongs(q),
      c.searchAlbums(q),
      c.searchArtists(q),
      c.searchPlaylists(q),
    ]);
    if (songs.status === 'rejected') throw songs.reason;
    const ok = (r) => (r.status === 'fulfilled' ? r.value : []);
    return {
      ...emptyResults(),
      tracks: songs.value.map((s) => mapSong(s)),
      albums: ok(albums).slice(0, 12).map(mapAlbum),
      artists: ok(artists).slice(0, 10).map(mapArtist),
      playlists: ok(playlists).slice(0, 12).map(mapPlaylist),
    };
  });
}

export function album(id) {
  return cache.wrap(`album:${id}`, async () => {
    const a = await (await ytm()).getAlbum(id);
    const meta = mapAlbum(a);
    const tracks = a.songs.map((s, i) => ({ ...mapSong(s, meta), cover: meta.cover, trackNumber: i + 1 }));
    return { album: { ...meta, trackCount: tracks.length }, tracks };
  });
}

export function artist(id) {
  return cache.wrap(`artist:${id}`, async () => {
    const a = await (await ytm()).getArtist(id);
    return {
      artist: mapArtist(a),
      topTracks: (a.topSongs || []).map((s) => mapSong(s)),
      albums: (a.topAlbums || []).map(mapAlbum),
      singles: (a.topSingles || []).map(mapAlbum),
      similar: (a.similarArtists || []).map(mapArtist),
    };
  });
}

export function playlist(id) {
  return cache.wrap(`playlist:${id}`, async () => {
    const c = await ytm();
    const [p, videos] = await Promise.all([c.getPlaylist(id), c.getPlaylistVideos(id)]);
    return {
      playlist: { ...mapPlaylist(p), trackCount: p.videoCount ?? videos.length },
      tracks: videos.map((v) => mapSong(v)),
    };
  });
}

export function home() {
  return cache.wrap('home', async () => {
    const sections = await (await ytm()).getHomeSections();
    return sections
      .map((s) => ({
        title: s.title,
        items: s.contents
          .map((x) => {
            if (x.type === 'SONG' || x.type === 'VIDEO') return { kind: 'track', ...mapSong(x) };
            if (x.type === 'ALBUM') return { kind: 'album', ...mapAlbum(x) };
            if (x.type === 'PLAYLIST') return { kind: 'playlist', ...mapPlaylist(x) };
            if (x.type === 'ARTIST') return { kind: 'artist', ...mapArtist(x) };
            return null;
          })
          .filter(Boolean),
      }))
      .filter((s) => s.items.length);
  }, 30 * 60_000);
}

export function suggestions(q) {
  return cache.wrap(`suggest:${q}`, async () => (await ytm()).getSearchSuggestions(q), 60 * 60_000);
}
