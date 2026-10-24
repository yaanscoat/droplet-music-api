import { api } from '../api.js';
import { shelf } from '../components/cards.js';
import { recent } from '../history.js';
import { icon } from '../icons.js';
import { likedTracks } from '../library.js';
import { artistLinks, esc, h, img, skeletonHome } from '../ui.js';

function greeting() {
  const hour = new Date().getHours();
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

const QUIPS = [
  'Your ears called. They want snacks.',
  'Press play. Neighbours are a social construct.',
  'Certified skip-free zone (mostly).',
  'Hydrate. Then put something on.',
  'No ads. No algorithm judging your 3am choices.',
  'Today’s forecast: 100% chance of bangers.',
  'Like a song and it lives here forever. Probably.',
];

/** Spotify-style quick tiles for whatever you played (or liked) most recently. */
function jumpBackIn(tracks) {
  const el = h(`
    <section class="shelf">
      <div class="shelf-head"><h2><span class="eyebrow">Pick up where you left off</span>Jump back in</h2></div>
      <div class="jump-grid">
        ${tracks
          .map(
            (t, i) => `
          <div class="jump-tile lg-lite" data-card-index="${i}" tabindex="0">
            ${img(t.cover, t.title, '')}
            <div class="jt-text"><strong>${esc(t.title)}</strong><small>${artistLinks(t)}</small></div>
            <button class="card-play" data-action="card-play" aria-label="Play ${esc(t.title)}">${icon('play')}</button>
          </div>`,
          )
          .join('')}
      </div>
    </section>`);
  const grid = el.querySelector('.jump-grid');
  grid._items = tracks.map((t) => ({ kind: 'track', ...t }));
  grid._tracks = grid._items;
  return el;
}

export default async function home(view, _params, ctx) {
  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
  const head = `
    <header class="greeting">
      <h1>${greeting()} <span class="wave-emoji" aria-hidden="true">👋</span></h1>
      <p>${esc(quip)}</p>
    </header>`;
  view.innerHTML = `<div class="page">${head}${skeletonHome()}</div>`;
  const page = view.firstElementChild;

  const recents = recent().slice(0, 6);
  const quick = recents.length >= 2 ? recents : likedTracks().slice(0, 6);
  const liked = likedTracks().slice(0, 20).map((t) => ({ kind: 'track', ...t }));
  const { sections } = await api.home().catch(() => ({ sections: [] }));
  if (ctx.isStale()) return;

  page.innerHTML = head;
  if (quick.length) page.append(jumpBackIn(quick));

  let first = true;
  sections.forEach((s, i) => {
    const allTracks = s.items.every((x) => x.kind === 'track');
    // The first all-songs section gets YouTube Music's "Quick picks" list layout.
    const layout = allTracks && first ? 'quick-picks' : 'cards';
    if (allTracks) first = false;
    page.append(shelf(s.title, s.items, { layout, eyebrow: layout === 'quick-picks' ? 'Fresh off the shelf' : '' }));
    if (i === 0 && liked.length) page.append(shelf('Your likes', liked, { eyebrow: 'Hearted by you' }));
  });

  if (!sections.length) {
    if (liked.length) page.append(shelf('Your likes', liked, { eyebrow: 'Hearted by you' }));
    page.insertAdjacentHTML(
      'beforeend',
      `<div class="empty"><div class="empty-art lg-lite">${icon('search')}</div><h2>The home feed is napping</h2><p>YouTube Music didn’t send a feed this time, but search works fine. Try the box up top.</p></div>`,
    );
  }
}
