// Droplet's own icon set: 24×24, rounded 1.8px strokes, with solid shapes where a glyph needs weight
// (play, pause, skip). Each entry is raw SVG children so icons can mix strokes and fills.

const S = (d) => `<path d="${d}"/>`;
const F = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`;

const icons = {
  // ── transport ──
  play: F('M8.2 5.3c0-1 1.1-1.6 1.9-1l9.6 6.6c.7.5.7 1.6 0 2.1l-9.6 6.6c-.8.6-1.9 0-1.9-1z'),
  pause: F('M7.5 4.5h2.6c.7 0 1.2.5 1.2 1.2v12.6c0 .7-.5 1.2-1.2 1.2H7.5c-.7 0-1.2-.5-1.2-1.2V5.7c0-.7.5-1.2 1.2-1.2zm6.4 0h2.6c.7 0 1.2.5 1.2 1.2v12.6c0 .7-.5 1.2-1.2 1.2h-2.6c-.7 0-1.2-.5-1.2-1.2V5.7c0-.7.5-1.2 1.2-1.2z'),
  next: F('M5.5 6.4c0-.9 1-1.4 1.7-.9l8.2 5.6c.6.4.6 1.4 0 1.8l-8.2 5.6c-.7.5-1.7 0-1.7-.9z') + S('M18.5 5.5v13'),
  prev: F('M18.5 6.4c0-.9-1-1.4-1.7-.9l-8.2 5.6c-.6.4-.6 1.4 0 1.8l8.2 5.6c.7.5 1.7 0 1.7-.9z') + S('M5.5 5.5v13'),
  shuffle:
    S('M3.5 7.5h2.8c1.9 0 3 .9 4 2.5l3.4 5.6c1 1.6 2.1 2.4 4 2.4h2.8') +
    S('M3.5 16.5h2.8c1.3 0 2.2-.4 3-1.2M13.7 8.7c.8-.8 1.7-1.2 3-1.2h2.8') +
    S('M17.5 5l3 2.5-3 2.5M17.5 14.5l3 2.5-3 2.5'),
  repeat: S('M16.5 3.5l3 3-3 3') + S('M4.5 11.5v-1a4 4 0 0 1 4-4h11') + S('M7.5 20.5l-3-3 3-3') + S('M19.5 12.5v1a4 4 0 0 1-4 4h-11'),

  // ── actions ──
  heart: S('M12 19.8s-7.6-4.4-7.6-10.2a4.3 4.3 0 0 1 7.6-2.8 4.3 4.3 0 0 1 7.6 2.8c0 5.8-7.6 10.2-7.6 10.2z'),
  'heart-fill': F('M12 19.8s-7.6-4.4-7.6-10.2a4.3 4.3 0 0 1 7.6-2.8 4.3 4.3 0 0 1 7.6 2.8c0 5.8-7.6 10.2-7.6 10.2z'),
  download: S('M12 4v10.5') + S('M7.5 10.5L12 15l4.5-4.5') + S('M5 19.5h14'),
  more: F('M12 7.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm0 6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm0 6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z'),
  'queue-add': S('M4 6.5h11M4 11.5h11M4 16.5h6.5') + S('M17.5 13.5v6M14.5 16.5h6'),
  'play-next': S('M4 6.5h14M4 11.5h14M4 16.5h7') + F('M14.5 14.2c0-.6.7-1 1.2-.6l3.6 2.4c.4.3.4 1 0 1.2l-3.6 2.4c-.5.4-1.2 0-1.2-.6z'),
  swap: S('M7.5 4L4 7.5 7.5 11M4 7.5h13') + S('M16.5 13l3.5 3.5-3.5 3.5M20 16.5H7'),
  close: S('M6.5 6.5l11 11M17.5 6.5l-11 11'),

  // ── navigation ──
  home: S('M4.5 10.2L12 4l7.5 6.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-3.2v-5.2a1 1 0 0 0-1-1h-3.6a1 1 0 0 0-1 1V20H6a1.5 1.5 0 0 1-1.5-1.5z'),
  search: '<circle cx="10.8" cy="10.8" r="6.3"/>' + S('M15.6 15.6L20 20'),
  library: S('M5.5 4.5v15M10 4.5v15') + S('M14.2 5.3l4.6 13.8'),
  left: S('M14.5 6l-6 6 6 6'),
  right: S('M9.5 6l6 6-6 6'),
  expand: S('M6.5 14.5l5.5-5.5 5.5 5.5'),
  collapse: S('M6.5 9.5l5.5 5.5 5.5-5.5'),

  // ── volume ──
  volume: S('M4.5 9.5v5h3L12 18V6L7.5 9.5z') + S('M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8'),
  'volume-low': S('M4.5 9.5v5h3L12 18V6L7.5 9.5z') + S('M15.5 9.2a4 4 0 0 1 0 5.6'),
  'volume-off': S('M4.5 9.5v5h3L12 18V6L7.5 9.5z') + S('M16 9.5l4.5 5M20.5 9.5l-4.5 5'),

  // ── things ──
  album: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/>' + S('M12 5.8a6.2 6.2 0 0 1 6.2 6.2'),
  person: '<circle cx="12" cy="8.4" r="3.6"/>' + S('M5 19.5c1.2-3.3 3.8-5.2 7-5.2s5.8 1.9 7 5.2'),
  music: S('M9 17.5V6.3l10-2v11') + '<circle cx="6.6" cy="17.5" r="2.4"/><circle cx="16.6" cy="15.3" r="2.4"/>',
  warning: S('M10.4 4.9L3.3 17.4A1.8 1.8 0 0 0 4.9 20h14.2a1.8 1.8 0 0 0 1.6-2.6L13.6 4.9a1.8 1.8 0 0 0-3.2 0z') + S('M12 10v3.6M12 16.6v.1'),
  sparkle: S('M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5z') + S('M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z'),
  queue: S('M4 6.5h16M4 11.5h10M4 16.5h10') + F('M16.5 13.8c0-.6.7-1 1.2-.6l3.3 2.2c.4.3.4 1 0 1.2l-3.3 2.2c-.5.4-1.2 0-1.2-.6z'),
  history: S('M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9') + S('M4.5 4.5V9H9') + S('M12 8v4.2l2.8 1.8'),
  check: S('M5 12.5l4.5 4.5L19 7.5'),
  wave: S('M3.5 12h2M7.5 8v8M11.5 5v14M15.5 9v6M19.5 11v2'),
};

export function icon(name, cls = '') {
  const body = icons[name];
  if (!body) return '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Fill every element marked `data-icon="name"` in `root`. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
}

export function setIcon(el, name) {
  if (el.dataset.icon === name && el.firstElementChild) return;
  el.dataset.icon = name;
  el.innerHTML = icon(name);
}
