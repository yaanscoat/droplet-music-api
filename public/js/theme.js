// Picks a palette out of the current cover art and feeds it to the ambient background + accent colour.
// Covers are loaded through /api/art (same origin), otherwise canvas refuses to let us read pixels.

const DEFAULT = { accent: '#ff6aa2', amb: ['#ff5c97', '#7b61ff', '#22c7ff'] };
const cache = new Map();
const root = document.documentElement;

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Up to three vivid, distinct hues from an image, most dominant first. */
async function extract(url) {
  const img = await loadImage(`/api/art?u=${encodeURIComponent(url)}`);
  const size = 40;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const bins = Array.from({ length: 18 }, () => ({ w: 0, h: 0, s: 0, l: 0 }));
  let grey = 0;
  let colorful = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.07 || l > 0.96) continue;
    if (s < 0.18) {
      grey++;
      continue;
    }
    colorful++;
    // Saturated mid-tones count most: that's what reads as "the colour" of a cover.
    const w = s ** 1.6 * (1 - Math.abs(l - 0.5) * 1.3);
    const bin = bins[Math.floor(h / 20) % 18];
    bin.w += w;
    bin.h += h * w;
    bin.s += s * w;
    bin.l += l * w;
  }

  const picks = bins
    .filter((b) => b.w > 0)
    .map((b) => ({ w: b.w, h: b.h / b.w, s: b.s / b.w, l: b.l / b.w }))
    .sort((a, b) => b.w - a.w)
    .filter((c, i, all) => all.slice(0, i).every((p) => Math.min(Math.abs(p.h - c.h), 360 - Math.abs(p.h - c.h)) > 28))
    .slice(0, 3);

  // A black-and-white cover: keep our brand colours rather than inventing a muddy theme.
  if (!picks.length || colorful < (colorful + grey) * 0.06) return DEFAULT;

  while (picks.length < 3) picks.push({ ...picks[picks.length - 1], h: (picks[picks.length - 1].h + 40) % 360 });
  const [a] = picks;
  return {
    accent: hsl(a.h, clamp(a.s, 0.62, 0.95), clamp(a.l, 0.62, 0.72)),
    accentInk: hsl(a.h, 0.7, 0.08),
    amb: picks.map((p) => hsl(p.h, clamp(p.s, 0.55, 0.9), clamp(p.l, 0.42, 0.58))),
  };
}

function apply(theme) {
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-ink', theme.accentInk || '#1a0610');
  theme.amb.forEach((c, i) => root.style.setProperty(`--amb-${i + 1}`, c));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.amb[1]);
}

let latest = 0;

/** Re-theme the app from a cover URL (or reset with no URL). */
export async function themeFrom(url) {
  const id = ++latest;
  if (!url) return apply(DEFAULT);
  try {
    if (!cache.has(url)) cache.set(url, extract(url));
    const theme = await cache.get(url);
    if (id === latest) apply(theme);
  } catch {
    cache.delete(url);
    if (id === latest) apply(DEFAULT);
  }
}
