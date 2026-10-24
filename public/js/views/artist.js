import { api } from '../api.js';
import { shelf } from '../components/cards.js';
import { trackList } from '../components/track-list.js';
import { esc, h, skeletonCollection } from '../ui.js';
import { actionsBar } from './collection.js';

export default async function artistView(view, [source, id], ctx) {
  view.innerHTML = `<div class="page">${skeletonCollection()}</div>`;
  const data = await api.artist(source, id);
  if (ctx.isStale()) return;

  const { artist, topTracks, albums, singles, similar } = data;
  const page = h(`
    <div class="page">
      <header class="artist-hero">
        <div class="artist-hero-img" style="background-image:url('${esc(artist.picture || '')}')"></div>
        <div>
          <h1>${esc(artist.name)}</h1>
        </div>
      </header>
    </div>`);

  if (topTracks.length) page.querySelector('.artist-hero > div:last-child').append(actionsBar(topTracks));

  if (topTracks.length) {
    page.append(h('<h2 class="section-title">Top songs</h2>'));
    const list = trackList(topTracks.slice(0, 5), { header: false });
    list._tracks = topTracks; // playing from the short list continues through all top songs
    page.append(list);
    if (topTracks.length > 5) {
      const more = h('<button class="btn lg-lite show-all">Show all</button>');
      more.addEventListener('click', () => {
        list.replaceWith(trackList(topTracks, { header: false }));
        more.remove();
      });
      page.append(more);
    }
    page.append(h('<div style="height:40px"></div>'));
  }

  if (albums.length) page.append(shelf('Albums', albums.map((a) => ({ kind: 'album', ...a }))));
  if (singles.length) page.append(shelf('Singles & EPs', singles.map((a) => ({ kind: 'album', ...a }))));
  if (similar.length) page.append(shelf('Fans might also like', similar.map((a) => ({ kind: 'artist', ...a }))));

  view.replaceChildren(page);
}
