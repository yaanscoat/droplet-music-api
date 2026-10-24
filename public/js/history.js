// "Recently played": kept in this browser only. Your listening history is between you and your speakers.
import { keyOf } from './ui.js';

const KEY = 'droplet.recent.v1';
const MAX = 30;

export function recent() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function pushRecent(track) {
  const { id, source, title, artist, artists, album, duration, cover, explicit } = track;
  const list = [{ id, source, title, artist, artists, album, duration, cover, explicit }, ...recent().filter((t) => keyOf(t) !== keyOf(track))];
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* private mode or full storage: forgetting is fine */
  }
}
