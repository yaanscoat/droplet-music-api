import { trackList } from '../components/track-list.js';
import { events, likedTracks } from '../library.js';
import { emptyState, fmtTotal, h } from '../ui.js';
import { actionsBar, hero } from './collection.js';

let listener = null;

export default async function likedView(view, _params, ctx) {
  const render = () => {
    if (ctx.isStale()) return events.removeEventListener('change', listener);
    const tracks = likedTracks();
    const total = tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const meta = `${tracks.length} song${tracks.length === 1 ? '' : 's'}${total ? `<span class="dot"></span>${fmtTotal(total)}` : ''}`;
    const page = h(`<div class="page">${hero({ kind: 'Playlist', title: 'Liked songs', meta, extraClass: 'liked-hero' })}</div>`);
    if (tracks.length) {
      page.append(actionsBar(tracks));
      page.append(trackList(tracks));
    } else {
      page.insertAdjacentHTML('beforeend', emptyState('heart', 'Songs you like will appear here', 'Tap the heart on any song to save it.'));
    }
    const scroll = view.scrollTop;
    view.replaceChildren(page);
    view.scrollTop = scroll;
  };

  if (listener) events.removeEventListener('change', listener);
  listener = render;
  events.addEventListener('change', listener);
  render();
}
