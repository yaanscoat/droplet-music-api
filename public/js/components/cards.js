import { icon } from '../icons.js';
import { albumHref, artistHref, artistLinks, esc, h, img, playlistHref } from '../ui.js';
import { trackRow } from './track-list.js';

export function hrefOf(item) {
  if (item.kind === 'album') return albumHref(item.source, item.id);
  if (item.kind === 'artist') return artistHref(item.source, item.id);
  if (item.kind === 'playlist') return playlistHref(item.id);
  return item.album?.id ? albumHref(item.source, item.album.id) : '';
}

function subtitle(item) {
  switch (item.kind) {
    case 'album': {
      const kind = item.type && item.type !== 'ALBUM' ? item.type[0] + item.type.slice(1).toLowerCase() : 'Album';
      return [kind, artistLinks(item), item.year].filter(Boolean).join(' • ');
    }
    case 'artist':
      return 'Artist';
    case 'playlist':
      return ['Playlist', esc(item.subtitle)].filter(Boolean).join(' • ');
    default:
      return artistLinks(item);
  }
}

/** One square card. `index` lets shelves of songs play from the clicked one. */
export function card(item, index) {
  const title = item.title || item.name;
  const href = hrefOf(item);
  return `
    <div class="card ${item.kind}" data-card-index="${index}" ${href ? `data-href="${esc(href)}"` : ''} tabindex="0">
      <div class="card-art">
        ${img(item.cover || item.picture, title, '')}
        <button class="card-play" data-action="card-play" aria-label="Play ${esc(title)}">${icon('play')}</button>
      </div>
      <div class="card-title" title="${esc(title)}">${esc(title)}</div>
      <div class="card-sub">${subtitle(item)}</div>
    </div>`;
}

/**
 * A titled horizontal carousel.
 * Items need a `kind` ('track' | 'album' | 'artist' | 'playlist').
 */
export function shelf(title, items, { eyebrow = '', layout = 'cards' } = {}) {
  const quick = layout === 'quick-picks';
  const tracks = items.filter((x) => x.kind === 'track');
  const el = h(`
    <section class="shelf">
      <div class="shelf-head">
        <h2>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}${esc(title)}</h2>
        <div class="shelf-nav">
          <button class="icon-btn" data-dir="-1" aria-label="Scroll left">${icon('left')}</button>
          <button class="icon-btn" data-dir="1" aria-label="Scroll right">${icon('right')}</button>
        </div>
      </div>
      ${
        quick
          ? `<div class="quick-picks track-list no-album">${tracks.map((t, i) => trackRow(t, i, { album: false })).join('')}</div>`
          : `<div class="shelf-row">${items.map((it, i) => card(it, i)).join('')}</div>`
      }
    </section>`);

  const row = el.querySelector('.shelf-row, .quick-picks');
  row._items = items;
  if (quick) row._tracks = tracks;
  else if (tracks.length === items.length) row._tracks = tracks;

  el.querySelector('.shelf-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dir]');
    if (btn) row.scrollBy({ left: Number(btn.dataset.dir) * row.clientWidth * 0.85 });
  });
  return el;
}

/** A wrapping grid of cards (search tabs, artist discography). */
export function cardGrid(items) {
  const el = h(`<div class="card-grid">${items.map((it, i) => card(it, i)).join('')}</div>`);
  el._items = items;
  return el;
}
