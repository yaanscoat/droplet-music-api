// Scores how well a playback candidate (a YouTube video, a SoundCloud upload…)
// matches the track the user picked from search.

const NOISE =
  /\b(official|audio|video|lyrics?|visuali[sz]er|hd|hq|4k|remaster(ed)?( \d{4})?|explicit|clean|mv|topic)\b/g;

export function normalize(text = '') {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (text) => new Set(normalize(text).split(' ').filter(Boolean));

/** Share of `a`'s words that also appear in `b` (0..1). */
function overlap(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size) return 0;
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits++;
  return hits / wa.size;
}

const VERSION_TAGS = ['remix', 'live', 'acoustic', 'instrumental', 'karaoke', 'cover', 'sped up', 'slowed', 'nightcore', '8d'];

/**
 * @param {{title:string, artist:string, duration?:number}} want
 * @param {{title:string, artist:string, duration?:number}} got
 * @returns {number} 0..1
 */
export function score(want, got) {
  const titleScore = overlap(want.title, got.title);
  // Uploaders often put the artist in the title ("Artist - Song") instead of the artist field.
  const artistScore = Math.max(overlap(want.artist, got.artist), overlap(want.artist, got.title));
  let s = titleScore * 0.55 + artistScore * 0.3;

  if (want.duration && got.duration) {
    const diff = Math.abs(want.duration - got.duration);
    s += diff <= 3 ? 0.15 : diff <= 10 ? 0.08 : diff > 45 ? -0.25 : 0;
  } else {
    s += 0.05;
  }

  // Penalise remixes/live versions/covers the user did not ask for.
  const wantTitle = normalize(want.title);
  const gotTitle = normalize(got.title);
  for (const tag of VERSION_TAGS) {
    if (gotTitle.includes(tag) && !wantTitle.includes(tag)) s -= 0.2;
  }
  return Math.max(0, Math.min(1, s));
}

/** The best-scoring candidate, or null if nothing clears `min`. */
export function best(want, candidates, min = 0.55) {
  let top = null;
  for (const c of candidates) {
    const s = score(want, c);
    if (!top || s > top.score) top = { ...c, score: s };
  }
  return top && top.score >= min ? top : null;
}
