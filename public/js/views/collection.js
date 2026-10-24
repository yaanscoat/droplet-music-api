// Album and playlist pages share one layout: a blurred-art hero, actions, and a track list.
import { api } from '../api.js';
import { trackList } from '../components/track-list.js';
import { icon } from '../icons.js';
import { player } from '../player.js';
import { SOURCE_LABEL, artistLinks, esc, fmtTotal, h, img, skeletonCollection } from '../ui.js';

export function hero({ kind, title, cover, meta, extraClass = '' }) {
  return `
    <header class="hero lg ${extraClass}">
      <div class="hero-bg" style="background-image:url('${esc(cover || '')}')"></div>
      ${cover !== undefined ? img(cover, title, '', 'hero-art') : `<div class="hero-art">${icon('heart-fill')}</div>`}
      <div class="hero-text">
        <span class="hero-kind">${esc(kind)}</span>
        <h1 class="hero-title" title="${esc(title)}">${esc(title)}</h1>
        <div class="hero-meta">${meta}</div>
      </div>
    </header>`;
}

export function actionsBar(tracks, { extra = '' } = {}) {
  const el = h(`
    <div class="actions-bar">
      <button class="play-fab" aria-label="Play">${icon('play')}</button>
      <button class="icon-btn" data-do="shuffle" aria-label="Shuffle" title="Shuffle">${icon('shuffle')}</button>
      <button class="icon-btn" data-do="queue" aria-label="Add to queue" title="Add to queue">${icon('queue-add')}</button>
      ${extra}
    </div>`);
  el.querySelector('.play-fab').addEventListener('click', () => player.playList(tracks, 0, { shuffle: false }));
  el.querySelector('[data-do="shuffle"]').addEventListener('click', () => player.playList(tracks, 0, { shuffle: true }));
  el.querySelector('[data-do="queue"]').addEventListener('click', () => player.addToQueue(tracks));
  return el;
}

const dot = (html) => (html ? `<span class="dot"></span>${html}` : '');

export async function albumView(view, [source, id], ctx) {
  view.innerHTML = `<div class="page">${skeletonCollection()}</div>`;
  const { album, tracks } = await api.album(source, id);
  if (ctx.isStale()) return;

  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const kind = album.type && album.type !== 'ALBUM' ? album.type[0] + album.type.slice(1).toLowerCase() : 'Album';
  const meta = [
    artistLinks(album),
    dot(album.year ? String(album.year) : ''),
    dot(`${tracks.length} song${tracks.length === 1 ? '' : 's'}`),
    dot(total ? fmtTotal(total) : ''),
  ].join('');

  const page = h(`<div class="page">${hero({ kind, title: album.title, cover: album.cover, meta })}</div>`);
  page.append(actionsBar(tracks));
  page.append(trackList(tracks, { album: false, art: false, numbers: tracks.map((t, i) => t.trackNumber || i + 1) }));
  page.append(
    h(`<p class="collection-foot">${album.releaseDate ? `Released ${esc(album.releaseDate)} · ` : ''}Catalog: ${esc(SOURCE_LABEL[album.source] || album.source)}</p>`),
  );
  view.replaceChildren(page);
}

export async function playlistView(view, [id], ctx) {
  view.innerHTML = `<div class="page">${skeletonCollection()}</div>`;
  const { playlist, tracks } = await api.playlist(id);
  if (ctx.isStale()) return;

  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const meta = [esc(playlist.subtitle || 'YouTube Music'), dot(`${tracks.length} songs`), dot(total ? fmtTotal(total) : '')].join('');
  const page = h(`<div class="page">${hero({ kind: 'Playlist', title: playlist.title, cover: playlist.cover, meta })}</div>`);
  page.append(actionsBar(tracks));
  page.append(trackList(tracks));
  view.replaceChildren(page);
}
