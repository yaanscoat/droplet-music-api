import { icon } from '../icons.js';
import { isLiked } from '../library.js';
import { player } from '../player.js';
import { $$, albumLink, artistLinks, esc, fmtTime, h, img, keyOf } from '../ui.js';

const EQ = '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>';

export function trackRow(t, i, { album = true, art = true, number } = {}) {
  const key = keyOf(t);
  const liked = isLiked(t);
  const badges = `${t.explicit ? '<span class="badge" title="Explicit">E</span>' : ''}${t.preview ? '<span class="badge preview" title="SoundCloud only offers a 30 second preview">PREVIEW</span>' : ''}`;
  return `
    <div class="track-row ${art ? 'has-art' : ''}" data-key="${esc(key)}" data-index="${i}">
      <div class="track-lead">
        ${art ? img(t.cover, t.title, '') : `<span class="track-num">${number ?? i + 1}</span>`}
        <button class="row-play" data-action="play" aria-label="Play ${esc(t.title)}">${icon('play')}${EQ}</button>
      </div>
      <div class="track-main">
        <div class="track-title" title="${esc(t.title)}">${badges}${esc(t.title)}</div>
        <div class="track-artist">${artistLinks(t)}</div>
      </div>
      ${album ? `<div class="track-album">${albumLink(t)}</div>` : ''}
      <div class="track-dur">${t.duration ? fmtTime(t.duration) : ''}</div>
      <div class="track-actions">
        <button class="icon-btn like-btn ${liked ? 'on' : ''}" data-action="like" data-like-key="${esc(key)}" aria-label="${liked ? 'Unlike' : 'Like'}" data-icon="${liked ? 'heart-fill' : 'heart'}">${icon(liked ? 'heart-fill' : 'heart')}</button>
        <button class="icon-btn download-btn" data-action="download" aria-label="Download" title="Download">${icon('download')}</button>
        <button class="icon-btn" data-action="more" aria-label="More options">${icon('more')}</button>
      </div>
    </div>`;
}

/**
 * A list of tracks. Clicking a row plays the whole list from that row.
 * @param {object[]} tracks
 * @param {{album?:boolean, art?:boolean, header?:boolean, numbers?:number[]}} opts
 */
export function trackList(tracks, { album = true, art = true, header = true, numbers } = {}) {
  const el = h(`
    <div class="track-list ${album ? '' : 'no-album'}">
      ${header ? `<div class="track-list-head"><span>#</span><span>Title</span>${album ? '<span>Album</span>' : ''}<span style="text-align:right">Time</span><span></span></div>` : ''}
      ${tracks.map((t, i) => trackRow(t, i, { album, art, number: numbers?.[i] })).join('')}
    </div>`);
  el._tracks = tracks;
  markCurrent(el);
  return el;
}

/** Highlight rows that match the currently playing track. */
export function markCurrent(root = document) {
  const key = player.current ? keyOf(player.current) : null;
  for (const row of $$('.track-row[data-key]', root)) {
    row.classList.toggle('is-current', row.dataset.key === key);
  }
}
