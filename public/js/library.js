import { api, downloadUrl } from './api.js';
import { setIcon } from './icons.js';
import { $$, keyOf, toast } from './ui.js';

// Liked songs live on the server (data/library.json); this mirrors them for instant UI updates.
const likes = new Map();
export const events = new EventTarget();

export async function loadLikes() {
  try {
    const { likes: list } = await api.likes();
    likes.clear();
    for (const t of list) likes.set(keyOf(t), t);
  } catch (err) {
    toast(`Couldn't load your likes: ${err.message}`, { type: 'error' });
  }
  sync();
}

export const isLiked = (t) => likes.has(keyOf(t));
export const likedTracks = () => [...likes.values()];

export async function toggleLike(track) {
  const key = keyOf(track);
  const wasLiked = likes.has(key);
  // Optimistic: update the UI first, roll back if the server says no.
  if (wasLiked) likes.delete(key);
  else likes.set(key, { ...track, likedAt: Date.now() });
  sync(key, true);
  try {
    await (wasLiked ? api.unlike(track) : api.like(track));
    toast(wasLiked ? 'Removed from Liked songs' : 'Added to Liked songs', { type: 'success' });
  } catch (err) {
    if (wasLiked) likes.set(key, track);
    else likes.delete(key);
    sync(key);
    toast(`Couldn't update likes: ${err.message}`, { type: 'error' });
  }
}

/** Update every like button on the page and tell listeners the likes changed. */
function sync(changedKey, animate = false) {
  paint(changedKey, animate);
  events.dispatchEvent(new CustomEvent('change', { detail: { key: changedKey } }));
}

/** Update every like button on the page (they carry data-like-key). */
function paint(changedKey, animate = false) {
  for (const btn of $$('[data-like-key]')) {
    const on = likes.has(btn.dataset.likeKey);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-label', on ? 'Unlike' : 'Like');
    btn.setAttribute('aria-pressed', String(on));
    setIcon(btn, on ? 'heart-fill' : 'heart');
    if (animate && btn.dataset.likeKey === changedKey && on) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
  }
  const count = likes.size;
  const label = $$('#liked-count')[0];
  if (label) label.textContent = `${count} song${count === 1 ? '' : 's'}`;
}

/** Repaint like buttons after new ones were rendered. Does not emit 'change'. */
export const refreshLikeButtons = () => paint();

/** Trigger a browser download of the track's audio. */
export function download(track) {
  const a = document.createElement('a');
  a.href = downloadUrl(track);
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
  toast(`Preparing “${track.title}”… your download will start shortly`);
}
