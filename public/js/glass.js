// Liquid glass, the fun part.
//
// Every element with [data-refract] gets its own SVG filter: a displacement map that is neutral grey
// in the middle and ramps at the edges, so whatever scrolls *behind* the panel bends near its rim like
// it's under a thick piece of glass. Red, green and blue are displaced by slightly different amounts
// for a hint of chromatic aberration. Only Chromium can use SVG filters in `backdrop-filter`; everyone
// else gets the (still very nice) frosted blur from glass.css.

const SVG_NS = 'http://www.w3.org/2000/svg';
const defs = document.getElementById('glass-defs');

export const supportsRefraction = !!navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand));

let counter = 0;

function displacementMap(w, h, radius, edge) {
  const b = Math.max(6, Math.min(w, h) * edge);
  const svg = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>
      <linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${b / 2.2}"/></filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#r)"/>
    <rect width="${w}" height="${h}" fill="url(#g)" style="mix-blend-mode:screen"/>
    <rect x="${b}" y="${b}" width="${Math.max(0, w - 2 * b)}" height="${Math.max(0, h - 2 * b)}" rx="${Math.max(0, radius - b / 2)}" fill="#808080" filter="url(#soft)"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function channel(scale, matrix, name) {
  return `
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d${name}"/>
    <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}"/>`;
}

function buildFilter(id, w, h, radius, strength) {
  const s = -strength;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(w));
  filter.setAttribute('height', String(h));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.innerHTML = `
    <feImage href="${displacementMap(w, h, radius, 0.16)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
    ${channel(s, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r')}
    ${channel(s * 1.06, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g')}
    ${channel(s * 1.12, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b')}
    <feBlend in="r" in2="g" mode="screen" result="rg"/>
    <feBlend in="rg" in2="b" mode="screen"/>`;
  return filter;
}

function refract(el) {
  const id = `lg-${++counter}`;
  const strength = Number(el.dataset.refract) || 34;
  let filter = null;
  let raf = 0;

  const update = () => {
    raf = 0;
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const next = buildFilter(id, w, h, Math.min(radius, h / 2, w / 2), strength);
    if (filter) filter.replaceWith(next);
    else defs.append(next);
    filter = next;
    el.style.setProperty('--lg-filter', `url(#${id})`);
  };

  new ResizeObserver(() => {
    if (!raf) raf = requestAnimationFrame(update);
  }).observe(el);
}

/** Specular glare that follows the pointer across glass surfaces. */
function trackGlare() {
  let pending = null;
  document.addEventListener(
    'pointermove',
    (e) => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = null;
        const el = e.target.closest?.('.lg');
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}

export function initGlass() {
  trackGlare();
  if (!supportsRefraction) return;
  document.documentElement.classList.add('lg-refract');
  for (const el of document.querySelectorAll('[data-refract]')) refract(el);
}
