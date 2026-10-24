// Helpers shared by the two Tidal-backed providers (the official API and Monochrome).
// Both use Tidal's own ids, so an album found through one can be opened through the other.

/** Tidal image ids look like "a1b2c3d4-...". Turn one into a CDN URL. */
export function tidalImage(uuid, size = 640) {
  if (!uuid) return null;
  if (uuid.startsWith('http')) return uuid;
  return `https://resources.tidal.com/images/${uuid.replace(/-/g, '/')}/${size}x${size}.jpg`;
}

/** "PT3M41S" → 221 */
export function isoDuration(value) {
  if (typeof value === 'number') return value;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(value || '');
  if (!m) return null;
  return Math.round((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0));
}

export function fullTitle(title, version) {
  return version && !title.toLowerCase().includes(version.toLowerCase()) ? `${title} (${version})` : title;
}

export const emptyResults = () => ({ tracks: [], albums: [], artists: [], playlists: [] });
