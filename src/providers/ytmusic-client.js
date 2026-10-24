import YTMusic from 'ytmusic-api';

// One shared, lazily-initialised YouTube Music client (used for both search and playback matching).
let client = null;
let initializing = null;

export async function ytm() {
  if (client) return client;
  initializing ??= (async () => {
    const c = new YTMusic();
    await c.initialize();
    client = c;
    return c;
  })().finally(() => (initializing = null));
  return initializing;
}

/** YouTube Music thumbnails come with a size suffix (=w60-h60); ask for a bigger one. */
export function bigThumb(thumbnails = [], size = 544) {
  const last = thumbnails.at(-1)?.url;
  if (!last) return null;
  if (/=w\d+-h\d+/.test(last)) return last.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
  if (/i\.ytimg\.com/.test(last)) return last.replace(/\/[a-z]*default\.jpg/, '/hqdefault.jpg');
  return last;
}

const artistOf = (a) => (a ? [{ id: a.artistId, name: a.name, source: 'ytmusic' }] : []);

export function mapSong(s, album) {
  return {
    id: s.videoId,
    source: 'ytmusic',
    title: s.name,
    artist: s.artist?.name || '',
    artists: artistOf(s.artist),
    album: s.album ? { id: s.album.albumId, title: s.album.name } : album || null,
    duration: s.duration || null,
    cover: bigThumb(s.thumbnails) || album?.cover || null,
    explicit: false,
  };
}

export function mapAlbum(a) {
  return {
    id: a.albumId,
    source: 'ytmusic',
    title: a.name,
    artist: a.artist?.name || '',
    artists: artistOf(a.artist),
    year: a.year || null,
    cover: bigThumb(a.thumbnails),
  };
}

export function mapArtist(a) {
  return { id: a.artistId, source: 'ytmusic', name: a.name, picture: bigThumb(a.thumbnails) };
}

export function mapPlaylist(p) {
  return {
    id: p.playlistId,
    source: 'ytmusic',
    title: p.name,
    subtitle: p.artist?.name || '',
    cover: bigThumb(p.thumbnails),
  };
}
