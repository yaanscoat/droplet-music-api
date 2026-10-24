import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Build a DOM element from an HTML string. */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const keyOf = (t) => `${t.source}:${t.id}`;

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function fmtTotal(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

export const SOURCE_LABEL = {
  tidal: 'Tidal',
  monochrome: 'Monochrome',
  ytmusic: 'YouTube Music',
  soundcloud: 'SoundCloud',
};

// ── Links ────────────────────────────────────────────────────────────────────
export const albumHref = (source, id) => `#/album/${source}/${encodeURIComponent(id)}`;
export const artistHref = (source, id) => `#/artist/${source}/${encodeURIComponent(id)}`;
export const playlistHref = (id) => `#/playlist/${encodeURIComponent(id)}`;

/** Artist names as links where we know the artist id. */
export function artistLinks(item) {
  const artists = item.artists?.filter((a) => a.name) || [];
  if (!artists.length) return esc(item.artist || '');
  return artists
    .map((a) => (a.id && a.source !== 'soundcloud' ? `<a href="${artistHref(a.source || item.source, a.id)}">${esc(a.name)}</a>` : esc(a.name)))
    .join(', ');
}

export function albumLink(track) {
  if (!track.album?.title) return '';
  if (!track.album.id) return esc(track.album.title);
  return `<a href="${albumHref(track.source, track.album.id)}">${esc(track.album.title)}</a>`;
}

/** A tiny placeholder cover so broken/missing art still looks intentional. */
export function placeholder(seed = '') {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  // A little droplet on a gradient: our "no cover art" cover.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 55% 16%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><path d="M50 26s-15 16.3-15 27.7a15 15 0 0 0 30 0C65 42.3 50 26 50 26z" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/><path d="M42 52c1-3.6 3.3-7.4 5.6-10.4" stroke="rgba(255,255,255,.7)" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const img = (src, seed, alt = '', cls = '') =>
  `<img class="${cls}" src="${esc(src || placeholder(seed))}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${placeholder(seed)}'">`;

// ── Toasts ───────────────────────────────────────────────────────────────────
export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const el = h(`<div class="toast ${type}">${icon(type === 'error' ? 'warning' : type === 'info' ? 'sparkle' : 'check')}<span>${esc(message)}</span></div>`);
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

// ── Context menu ─────────────────────────────────────────────────────────────
let closeMenu = null;

/**
 * @param {HTMLElement|{x:number,y:number}} anchor
 * @param {Array<{label:string, icon?:string, href?:string, onClick?:Function} | 'divider'>} items
 */
export function showMenu(anchor, items, { onClose } = {}) {
  closeMenu?.();
  const menu = $('#menu');
  menu.innerHTML = items
    .map((it, i) => {
      if (it === 'divider') return '<hr>';
      const inner = `${icon(it.icon || 'music')}<span>${esc(it.label)}</span>`;
      return it.href
        ? `<a role="menuitem" href="${esc(it.href)}" data-i="${i}">${inner}</a>`
        : `<button role="menuitem" data-i="${i}">${inner}</button>`;
    })
    .join('');
  menu.hidden = false;

  const rect = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const { width, height } = menu.getBoundingClientRect();
  let left = rect.right - width;
  let top = rect.bottom + 4;
  if (left < 8) left = Math.min(rect.left, innerWidth - width - 8);
  if (top + height > innerHeight - 8) top = Math.max(8, rect.top - height - 4);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${top}px`;

  const onClick = (e) => {
    const target = e.target.closest('[data-i]');
    if (!target) return;
    const item = items[Number(target.dataset.i)];
    close();
    item.onClick?.();
  };
  const onOutside = (e) => {
    if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains?.(e.target)) close();
  };
  const onKey = (e) => e.key === 'Escape' && close();

  function close() {
    menu.hidden = true;
    menu.removeEventListener('click', onClick);
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', close);
    $('#view').removeEventListener('scroll', close);
    closeMenu = null;
    onClose?.();
  }

  menu.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey);
  addEventListener('resize', close);
  $('#view').addEventListener('scroll', close, { passive: true });
  closeMenu = close;
}

// ── Skeletons ────────────────────────────────────────────────────────────────
export const skeletonList = (rows = 8) =>
  `<div class="skeleton skeleton-title"></div>${'<div class="skeleton skeleton-row"></div>'.repeat(rows)}`;

export const skeletonCollection = () => `<div class="skeleton skeleton-hero"></div>${skeletonList(10)}`;

export const skeletonHome = () =>
  `<div class="skeleton skeleton-title"></div><div class="skeleton-cards">${'<div class="skeleton"></div>'.repeat(6)}</div>`.repeat(3);

export function emptyState(iconName, title, text = '') {
  return `<div class="empty"><div class="empty-art lg-lite">${icon(iconName)}</div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}
