import { api } from '../api.js';
import { cardGrid, hrefOf, shelf } from '../components/cards.js';
import { trackList } from '../components/track-list.js';
import { icon } from '../icons.js';
import { normalize } from '../text.js';
import { SOURCE_LABEL, artistLinks, emptyState, esc, h, img, skeletonList } from '../ui.js';

const TABS = [
  ['all', 'All'],
  ['songs', 'Songs'],
  ['albums', 'Albums'],
  ['artists', 'Artists'],
  ['playlists', 'Playlists'],
];

const SOURCES = [
  ['', 'Auto'],
  ['tidal', 'Tidal'],
  ['monochrome', 'Monochrome'],
  ['ytmusic', 'YouTube Music'],
  ['soundcloud', 'SoundCloud'],
];

// [name, colour, icon]
const GENRES = [
  ['Pop', '#ff3d7f', 'sparkle'], ['Hip-Hop', '#ff8a1f', 'wave'], ['Rock', '#e5383b', 'album'], ['Electronic', '#3a7bff', 'wave'],
  ['Indie', '#7cb518', 'music'], ['R&B', '#d63aff', 'heart'], ['Jazz', '#2fb3c9', 'music'], ['Lo-fi', '#8f7bff', 'history'],
  ['K-Pop', '#ff5fa2', 'sparkle'], ['Latin', '#ff4d4d', 'wave'], ['Classical', '#b08350', 'album'], ['Metal', '#6c6c80', 'warning'],
  ['Country', '#e07a2f', 'music'], ['Afrobeats', '#1fb57a', 'wave'], ['Chill', '#5867ff', 'history'], ['Workout', '#ff6b35', 'sparkle'],
];

function link(q, tab, source) {
  const p = new URLSearchParams({ q });
  if (tab && tab !== 'all') p.set('tab', tab);
  if (source) p.set('source', source);
  return `#/search?${p}`;
}

function browse(view) {
  view.innerHTML = `
    <div class="page">
      <header class="greeting">
        <h1>Browse all</h1>
        <p>Can’t decide? Let a genre decide for you.</p>
      </header>
      <div class="genre-grid">
        ${GENRES.map(([g, c, ico]) => `<a class="genre" href="${link(g)}" style="--c:${c}"><span>${esc(g)}</span>${icon(ico)}</a>`).join('')}
      </div>
    </div>`;
}

/** Pick the most relevant single result for the big "Top result" card. */
function topResult(q, res) {
  const nq = normalize(q);
  const artist = res.artists[0];
  if (artist && normalize(artist.name) === nq) return { kind: 'artist', ...artist };
  const album = res.albums.find((a) => normalize(a.title) === nq);
  if (album && !res.tracks.some((t) => normalize(t.title) === nq)) return { kind: 'album', ...album };
  if (res.tracks[0]) return { kind: 'track', ...res.tracks[0] };
  if (artist) return { kind: 'artist', ...artist };
  return null;
}

function topCard(item) {
  const title = item.title || item.name;
  const kind = { track: 'Song', album: 'Album', artist: 'Artist' }[item.kind];
  const href = hrefOf(item);
  const el = h(`
    <div class="top-result lg ${item.kind}" data-card-index="0" ${item.kind !== 'track' && href ? `data-href="${esc(href)}"` : ''}>
      ${img(item.cover || item.picture, title, '')}
      <div>
        <h3 title="${esc(title)}">${esc(title)}</h3>
        <p>${item.kind === 'artist' ? '' : artistLinks(item)}<span class="tag">${kind}</span></p>
      </div>
      <button class="play-fab" data-action="card-play" aria-label="Play ${esc(title)}">${icon('play')}</button>
    </div>`);
  const wrap = h('<div class="card-host"></div>');
  wrap.append(el);
  wrap._items = [item];
  return wrap;
}

export default async function search(view, _params, ctx) {
  const q = (ctx.query.get('q') || '').trim();
  const tab = ctx.query.get('tab') || 'all';
  const source = ctx.query.get('source') || '';
  document.getElementById('search-input').value = q;
  if (!q) return browse(view);

  const chips = `
    <div class="chips">
      ${TABS.map(([k, label]) => `<a class="chip ${k === tab ? 'active' : ''}" href="${link(q, k, source)}">${label}</a>`).join('')}
    </div>
    <div class="chips">
      <span class="chip-row-label">Source</span>
      ${SOURCES.map(([k, label]) => `<a class="chip ${k === source ? 'active' : ''}" href="${link(q, tab, k)}">${label}</a>`).join('')}
    </div>`;

  view.innerHTML = `<div class="page">${chips}${skeletonList(8)}</div>`;
  const page = view.firstElementChild;

  const res = await api.search(q, source || undefined);
  if (ctx.isStale()) return;
  document.getElementById('source-pill').textContent = res.provider ? `via ${SOURCE_LABEL[res.provider]}` : '';

  page.innerHTML = chips;

  if (res.errors?.length) {
    const failed = res.errors.map((e) => SOURCE_LABEL[e.provider] || e.provider).join(' and ');
    const msg = res.provider
      ? `${failed} didn't answer, so these results come from ${SOURCE_LABEL[res.provider]}.`
      : `No results. ${res.errors.map((e) => `${SOURCE_LABEL[e.provider] || e.provider}: ${e.error}`).join(' · ')}`;
    page.append(h(`<div class="notice lg-lite">${icon('warning')}<span>${esc(msg)}</span></div>`));
  }

  if (!res.tracks.length && !res.albums.length && !res.artists.length) {
    page.insertAdjacentHTML('beforeend', emptyState('search', `No results for “${q}”`, 'Check the spelling, or try another source with the chips above. Even we can’t find songs that don’t exist (yet).'));
    return;
  }

  const albums = res.albums.map((a) => ({ kind: 'album', ...a }));
  const artists = res.artists.map((a) => ({ kind: 'artist', ...a }));
  const playlists = (res.playlists || []).map((p) => ({ kind: 'playlist', ...p }));

  if (tab === 'songs') {
    page.append(res.tracks.length ? trackList(res.tracks) : h(emptyState('music', 'No songs found')));
  } else if (tab === 'albums') {
    page.append(albums.length ? cardGrid(albums) : h(emptyState('album', 'No albums found')));
  } else if (tab === 'artists') {
    page.append(artists.length ? cardGrid(artists) : h(emptyState('person', 'No artists found')));
  } else if (tab === 'playlists') {
    page.append(playlists.length ? cardGrid(playlists) : h(emptyState('library', 'No playlists found', 'Playlists come from YouTube Music only.')));
  } else {
    const top = topResult(q, res);
    const grid = h(`<div class="search-top"><div><h2 class="section-title">Top result</h2></div><div><h2 class="section-title">Songs</h2></div></div>`);
    if (top) grid.children[0].append(topCard(top));
    grid.children[1].append(trackList(res.tracks.slice(0, 5), { album: false, header: false }));
    page.append(grid);
    if (artists.length) page.append(shelf('Artists', artists));
    if (albums.length) page.append(shelf('Albums', albums));
    if (playlists.length) page.append(shelf('Playlists', playlists));
    if (res.tracks.length > 5) {
      page.append(h('<h2 class="section-title">More songs</h2>'));
      page.append(trackList(res.tracks.slice(5), { header: false }));
    }
  }
}
