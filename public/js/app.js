import { api } from './api.js';
import { markCurrent, trackRow } from './components/track-list.js';
import { initGlass } from './glass.js';
import { pushRecent, recent } from './history.js';
import { hydrateIcons, icon, setIcon } from './icons.js';
import { download, isLiked, loadLikes, refreshLikeButtons, toggleLike } from './library.js';
import { player } from './player.js';
import { current as currentRoute, navigate, onNavigate, route, start } from './router.js';
import { themeFrom } from './theme.js';
import { $, $$, SOURCE_LABEL, albumHref, artistHref, artistLinks, esc, fmtTime, img, keyOf, placeholder, showMenu, toast } from './ui.js';
import { startVisualizer, stopVisualizer } from './visualizer.js';
import artistView from './views/artist.js';
import { albumView, playlistView } from './views/collection.js';
import home from './views/home.js';
import likedView from './views/liked.js';
import search from './views/search.js';

hydrateIcons();
initGlass();

// ── Routes ───────────────────────────────────────────────────────────────────
route(/^\/$/, home);
route(/^\/search$/, search);
route(/^\/album\/(\w+)\/(.+)$/, albumView);
route(/^\/artist\/(\w+)\/(.+)$/, artistView);
route(/^\/playlist\/(.+)$/, playlistView);
route(/^\/liked$/, likedView);

onNavigate(({ path }) => {
  const section = path === '/' ? 'home' : path.startsWith('/search') ? 'search' : path.startsWith('/liked') ? 'liked' : '';
  for (const a of $$('[data-nav]')) a.classList.toggle('active', a.dataset.nav === section);
  moveNavIndicator();
  if (!path.startsWith('/search')) $('#source-pill').textContent = '';
  closeNowPlaying();
});

/** Slide the glass pill in the sidebar to the active link. */
function moveNavIndicator() {
  const indicator = $('.nav-indicator');
  const active = $('.sidebar .nav-link.active');
  indicator.style.setProperty('--o', active ? '1' : '0');
  if (active) indicator.style.setProperty('--y', `${active.offsetTop}px`);
}
addEventListener('resize', moveNavIndicator);

/** Last few played songs in the sidebar. */
function renderRecent() {
  const list = recent().slice(0, 5);
  const box = $('#recent-list');
  box.innerHTML = list
    .map(
      (t, i) => `
      <div class="recent-item" role="button" tabindex="0" data-card-index="${i}" title="${esc(t.title)}">
        ${img(t.cover, t.title, '')}
        <span class="recent-text"><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span>
      </div>`,
    )
    .join('');
  box._items = list.map((t) => ({ kind: 'track', ...t }));
  box._tracks = box._items;
  const key = player.current && keyOf(player.current);
  for (const [i, el] of [...box.children].entries()) el.classList.toggle('is-current', keyOf(list[i]) === key);
}

// Re-highlight the playing row whenever a view renders.
new MutationObserver(() => markCurrent($('#view'))).observe($('#view'), { childList: true });

$('#view').addEventListener('scroll', (e) => $('#app').classList.toggle('scrolled', e.target.scrollTop > 4), { passive: true });

// ── Finding the track/item behind a clicked element ──────────────────────────
function findUp(el, prop) {
  for (let n = el; n && n !== document; n = n.parentElement) if (n[prop]) return n;
  return null;
}

function trackOf(el) {
  if (el.closest('#player')) return player.current;
  const row = el.closest('.track-row[data-index]');
  const list = row && findUp(row, '_tracks');
  return list ? list._tracks[Number(row.dataset.index)] : null;
}

async function playItem(item, container) {
  try {
    if (item.kind === 'track' || !item.kind) {
      const tracks = container?._tracks || [item];
      const idx = Math.max(0, tracks.findIndex((t) => keyOf(t) === keyOf(item)));
      return player.playList(tracks, idx);
    }
    toast(`Loading ${item.title || item.name}…`, { duration: 1500 });
    let tracks = [];
    if (item.kind === 'album') tracks = (await api.album(item.source, item.id)).tracks;
    if (item.kind === 'playlist') tracks = (await api.playlist(item.id)).tracks;
    if (item.kind === 'artist') tracks = (await api.artist(item.source, item.id)).topTracks;
    if (!tracks.length) return toast('Nothing to play here', { type: 'error' });
    player.playList(tracks, 0, { shuffle: false });
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
}

function playRow(row) {
  const list = findUp(row, '_tracks');
  if (!list) return;
  const index = Number(row.dataset.index);
  if (list._onPlay) return list._onPlay(index);
  const track = list._tracks[index];
  if (player.current && keyOf(player.current) === keyOf(track)) return player.toggle();
  player.playList(list._tracks, index);
}

function trackMenu(track, anchor, row = anchor.closest?.('.track-row')) {
  const liked = isLiked(track);
  const artist = track.artists?.find((a) => a.id && a.source !== 'soundcloud');
  const items = [
    { label: 'Play next', icon: 'play-next', onClick: () => player.playNext(track) },
    { label: 'Add to queue', icon: 'queue-add', onClick: () => player.addToQueue(track) },
    'divider',
    { label: liked ? 'Remove from Liked songs' : 'Add to Liked songs', icon: liked ? 'heart-fill' : 'heart', onClick: () => toggleLike(track) },
    { label: 'Download', icon: 'download', onClick: () => download(track) },
  ];
  if (track.album?.id || artist) items.push('divider');
  if (track.album?.id) items.push({ label: 'Go to album', icon: 'album', href: albumHref(track.source, track.album.id) });
  if (artist) items.push({ label: 'Go to artist', icon: 'person', href: artistHref(artist.source || track.source, artist.id) });
  if (track.source === 'tidal') {
    items.push('divider', {
      label: 'Wrong song? Find another match',
      icon: 'swap',
      onClick: async () => {
        await api.unmatch(track).catch(() => {});
        toast('Match cleared. It will be searched again next time it plays.');
      },
    });
  }
  row?.classList.add('menu-open');
  showMenu(anchor, items, { onClose: () => row?.classList.remove('menu-open') });
}

// ── Global click handling ────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    e.preventDefault();
    e.stopPropagation();
    const action = actionEl.dataset.action;
    if (action === 'play') return playRow(actionEl.closest('.track-row'));
    if (action === 'card-play') {
      const card = actionEl.closest('[data-card-index]');
      const host = findUp(card, '_items');
      return host && playItem(host._items[Number(card.dataset.cardIndex)], host);
    }
    const track = trackOf(actionEl);
    if (!track) return;
    if (action === 'like') return toggleLike(track);
    if (action === 'download') return download(track);
    if (action === 'more') return trackMenu(track, actionEl);
    return;
  }

  if (e.target.closest('a, button, input')) return;

  // Cards: open the album/artist/playlist, or play a song card.
  const card = e.target.closest('[data-card-index]');
  if (card) {
    if (card.dataset.href) return navigate(card.dataset.href);
    const host = findUp(card, '_items');
    return host && playItem(host._items[Number(card.dataset.cardIndex)], host);
  }

  // Rows: tap to play on touch screens; desktop uses double-click (like Spotify).
  const row = e.target.closest('.track-row[data-index]');
  if (row && (matchMedia('(pointer: coarse)').matches || row.closest('.np-queue-list'))) playRow(row);
});

document.addEventListener('dblclick', (e) => {
  if (e.target.closest('a, button')) return;
  const row = e.target.closest('.track-row[data-index]');
  if (row && !row.closest('.np-queue-list')) playRow(row);
});

document.addEventListener('contextmenu', (e) => {
  const row = e.target.closest('.track-row[data-index]');
  const track = row && trackOf(row);
  if (!track) return;
  e.preventDefault();
  trackMenu(track, { x: e.clientX, y: e.clientY }, row);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-card-index]')) e.target.click();
});

// ── Search box + suggestions ────────────────────────────────────────────────
const input = $('#search-input');
const suggestBox = $('#suggest');
let suggestTimer = 0;
let suggestItems = [];
let activeSuggestion = -1;

function goSearch(q) {
  q = q.trim();
  if (!q) return;
  suggestBox.hidden = true;
  input.blur();
  const { query } = currentRoute();
  const params = new URLSearchParams({ q });
  if (query.get('source')) params.set('source', query.get('source'));
  navigate(`#/search?${params}`);
}

function renderSuggestions() {
  activeSuggestion = -1;
  if (!suggestItems.length || document.activeElement !== input) return (suggestBox.hidden = true);
  const q = input.value.trim().toLowerCase();
  suggestBox.innerHTML = suggestItems
    .map((s, i) => {
      const text = s.toLowerCase().startsWith(q) ? `${esc(s.slice(0, q.length))}<b>${esc(s.slice(q.length))}</b>` : esc(s);
      return `<li role="option" data-i="${i}">${icon('search')}<span>${text}</span></li>`;
    })
    .join('');
  suggestBox.hidden = false;
}

input.addEventListener('input', () => {
  $('#search-clear').hidden = !input.value;
  clearTimeout(suggestTimer);
  const q = input.value.trim();
  if (!q) {
    suggestItems = [];
    return renderSuggestions();
  }
  suggestTimer = setTimeout(async () => {
    suggestItems = (await api.suggest(q).catch(() => [])).slice(0, 8);
    if (input.value.trim() === q) renderSuggestions();
  }, 160);
});

input.addEventListener('keydown', (e) => {
  if (suggestBox.hidden || !suggestItems.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestion = (activeSuggestion + (e.key === 'ArrowDown' ? 1 : -1) + suggestItems.length + 1) % (suggestItems.length + 1);
    $$('li', suggestBox).forEach((li, i) => li.classList.toggle('active', i === activeSuggestion));
    if (suggestItems[activeSuggestion]) input.value = suggestItems[activeSuggestion];
  } else if (e.key === 'Escape') {
    suggestBox.hidden = true;
  }
});

input.addEventListener('blur', () => setTimeout(() => (suggestBox.hidden = true), 150));
input.addEventListener('focus', () => suggestItems.length && renderSuggestions());
suggestBox.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li');
  if (li) goSearch(suggestItems[Number(li.dataset.i)]);
});
$('#search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  goSearch(input.value);
});
$('#search-clear').addEventListener('click', () => {
  input.value = '';
  $('#search-clear').hidden = true;
  input.focus();
});

// ── Player bar ───────────────────────────────────────────────────────────────
const audio = player.audio;
const bar = $('#player');
const progress = $('#progress');
let dragging = false;

const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : player.current?.duration || 0);

/** Ask the image CDNs for a larger version for the full-screen view. */
function bigCover(url) {
  return url ? url.replace(/=w\d+-h\d+/, '=w1200-h1200').replace('/640x640.jpg', '/1280x1280.jpg') : '';
}

function renderTrack() {
  const t = player.current;
  const has = !!t;
  for (const id of ['btn-like', 'btn-more', 'btn-download']) $(`#${id}`).disabled = !has;
  $('#player-title').textContent = t?.title || 'Nothing playing yet';
  $('#player-artist').innerHTML = t ? artistLinks(t) : 'Pick a song, any song';
  const art = $('#player-art');
  if (t) {
    art.src = t.cover || placeholder(t.title);
    art.onerror = () => (art.src = placeholder(t.title));
  } else art.removeAttribute('src');
  const like = $('#btn-like');
  if (t) like.dataset.likeKey = keyOf(t);
  else delete like.dataset.likeKey;
  refreshLikeButtons();
  document.title = t ? `${t.title} • ${t.artist}` : 'Droplet';
  themeFrom(t?.cover);
  markCurrent();
  renderRecent();
  renderNowPlaying();
}

// Remember a song in "recently played" once it actually starts, not just when it's queued.
let lastRecorded = null;
player.addEventListener('state', () => {
  const t = player.current;
  if (player.state !== 'playing' || !t || keyOf(t) === lastRecorded) return;
  lastRecorded = keyOf(t);
  pushRecent(t);
  renderRecent();
});

function renderState() {
  const playing = player.state === 'playing';
  bar.dataset.state = player.current ? player.state : 'idle';
  $('#app').classList.toggle('is-playing', playing);
  const btn = $('#btn-play');
  setIcon(btn, playing ? 'pause' : 'play');
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function renderTime() {
  const d = duration();
  if (!dragging) {
    const pct = d ? (audio.currentTime / d) * 100 : 0;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-thumb').style.left = `${pct}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
    $('#time-cur').textContent = fmtTime(audio.currentTime);
  }
  $('#time-dur').textContent = fmtTime(d);
  if (audio.buffered.length && d) {
    $('#progress-buffer').style.width = `${(audio.buffered.end(audio.buffered.length - 1) / d) * 100}%`;
  } else {
    $('#progress-buffer').style.width = '0';
  }
}

function renderMode() {
  $('#btn-shuffle').classList.toggle('on', player.shuffle);
  const rep = $('#btn-repeat');
  rep.classList.toggle('on', player.repeat !== 'off');
  rep.classList.toggle('one', player.repeat === 'one');
  rep.setAttribute('aria-label', `Repeat: ${player.repeat}`);
  const vol = $('#volume');
  const level = audio.muted ? 0 : audio.volume;
  vol.value = String(level);
  vol.style.setProperty('--fill', `${level * 100}%`);
  setIcon($('#btn-mute'), level === 0 ? 'volume-off' : level < 0.5 ? 'volume-low' : 'volume');
}

player.addEventListener('track', renderTrack);
player.addEventListener('state', renderState);
player.addEventListener('time', renderTime);
player.addEventListener('mode', renderMode);
player.addEventListener('queue', renderNowPlaying);

$('#btn-play').addEventListener('click', () => player.toggle());
$('#btn-next').addEventListener('click', () => player.next());
$('#btn-prev').addEventListener('click', () => player.prev());
$('#btn-shuffle').addEventListener('click', () => player.toggleShuffle());
$('#btn-repeat').addEventListener('click', () => player.cycleRepeat());
$('#btn-mute').addEventListener('click', () => player.toggleMute());
$('#volume').addEventListener('input', (e) => player.setVolume(Number(e.target.value)));
$('#btn-like').addEventListener('click', () => player.current && toggleLike(player.current));
$('#btn-download').addEventListener('click', () => player.current && download(player.current));
$('#btn-more').addEventListener('click', (e) => player.current && trackMenu(player.current, e.currentTarget));

// Seeking: click or drag anywhere on the thin bar above the player.
function ratioAt(clientX) {
  const r = progress.getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
}
function preview(clientX) {
  const ratio = ratioAt(clientX);
  const tip = $('#progress-tip');
  tip.textContent = fmtTime(ratio * duration());
  tip.style.left = `${Math.min(Math.max(ratio * 100, 2), 98)}%`;
  return ratio;
}
progress.addEventListener('pointermove', (e) => {
  const ratio = preview(e.clientX);
  if (dragging) {
    $('#progress-fill').style.width = `${ratio * 100}%`;
    $('#progress-thumb').style.left = `${ratio * 100}%`;
    $('#time-cur').textContent = fmtTime(ratio * duration());
  }
});
progress.addEventListener('pointerdown', (e) => {
  if (!player.current) return;
  dragging = true;
  progress.classList.add('dragging');
  progress.setPointerCapture(e.pointerId);
  progress.dispatchEvent(new PointerEvent('pointermove', e));
});
progress.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  progress.classList.remove('dragging');
  player.seek(ratioAt(e.clientX) * duration());
});
progress.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') player.seek(audio.currentTime + 5);
  if (e.key === 'ArrowLeft') player.seek(audio.currentTime - 5);
});

// ── Now playing overlay ─────────────────────────────────────────────────────
const np = $('#now-playing');

function openNowPlaying() {
  if (!player.current) return;
  np.hidden = false;
  $('#btn-expand').classList.add('on');
  renderNowPlaying();
  // Opening Now Playing is a click, which is exactly the user gesture Web Audio wants.
  startVisualizer(audio, $('#np-viz'), $('#np-art-wrap'));
}
function closeNowPlaying() {
  if (np.hidden) return;
  np.hidden = true;
  $('#btn-expand').classList.remove('on');
  stopVisualizer();
}
const toggleNowPlaying = () => (np.hidden ? openNowPlaying() : closeNowPlaying());
$('#btn-expand').addEventListener('click', toggleNowPlaying);
$('#btn-art').addEventListener('click', toggleNowPlaying);
$('#np-close').addEventListener('click', closeNowPlaying);

let sourceToken = 0;
function renderNowPlaying() {
  if (np.hidden) return;
  const t = player.current;
  if (!t) return closeNowPlaying();
  const cover = bigCover(t.cover) || placeholder(t.title);
  $('#np-art').src = cover;
  $('#np-backdrop').style.backgroundImage = `url('${cover}')`;
  $('#np-title').textContent = t.title;
  $('#np-artist').innerHTML = artistLinks(t);

  // Show where the audio actually comes from (useful when a Tidal track is matched to YouTube).
  const token = ++sourceToken;
  $('#np-source').textContent = `Catalog: ${SOURCE_LABEL[t.source] || t.source}`;
  api
    .resolve(t)
    .then((m) => {
      if (token !== sourceToken) return;
      const via = SOURCE_LABEL[m.provider] || m.provider;
      $('#np-source').textContent =
        m.provider === t.source ? `Playing from ${via}` : `Catalog: ${SOURCE_LABEL[t.source] || t.source} · Audio: ${via}${m.title ? ` (“${m.title}”)` : ''}`;
    })
    .catch(() => {});

  const next = player.upNext.slice(0, 100);
  const list = $('#np-queue');
  list.innerHTML = `
    <div class="queue-label">Now playing</div>
    <div class="np-now">${trackRow(t, 0, { album: false })}</div>
    ${next.length ? '<div class="queue-label">Next up</div>' : ''}
    <div class="np-next">${next.map((x, i) => trackRow(x, i, { album: false })).join('')}</div>`;
  const now = list.querySelector('.np-now');
  now._tracks = [t];
  now._onPlay = () => player.toggle();
  const upcoming = list.querySelector('.np-next');
  upcoming._tracks = next;
  upcoming._onPlay = (i) => player.jumpTo(i);
  for (const el of list.querySelectorAll('.track-row')) el.querySelector('.track-dur')?.remove();
  refreshLikeButtons();
  markCurrent(list);
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      player.toggle();
      break;
    case '/':
      e.preventDefault();
      input.focus();
      input.select();
      break;
    case 'ArrowRight':
      if (e.shiftKey) player.next();
      else player.seek(audio.currentTime + 10);
      break;
    case 'ArrowLeft':
      if (e.shiftKey) player.prev();
      else player.seek(audio.currentTime - 10);
      break;
    case 'l':
      player.current && toggleLike(player.current);
      break;
    case 'm':
      player.toggleMute();
      break;
    case 's':
      player.toggleShuffle();
      break;
    case 'r':
      player.cycleRepeat();
      break;
    case 'f':
      np.hidden ? openNowPlaying() : closeNowPlaying();
      break;
    case 'Escape':
      closeNowPlaying();
      break;
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────
renderTrack();
renderState();
renderMode();
renderTime();
await loadLikes();
start();
