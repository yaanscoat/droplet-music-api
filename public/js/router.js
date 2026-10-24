// Minimal hash router: "#/album/tidal/123?x=1" → { path: '/album/tidal/123', query }.

const routes = [];
let token = 0;
let onChange = () => {};

export function route(pattern, view) {
  routes.push({ pattern, view });
}

export function onNavigate(fn) {
  onChange = fn;
}

export function current() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const { path, query } = current();
  const id = ++token;
  const container = document.getElementById('view');
  for (const { pattern, view } of routes) {
    const m = pattern.exec(path);
    if (!m) continue;
    const params = m.slice(1).map(decodeURIComponent);
    onChange({ path, query });
    container.scrollTop = 0;
    // Views check isStale() after awaiting so a slow response can't overwrite a newer page.
    const ctx = { query, isStale: () => id !== token };
    try {
      await view(container, params, ctx);
    } catch (err) {
      if (ctx.isStale()) return;
      console.error(err);
      container.innerHTML = `<div class="page"><div class="empty"><h2>Something went wrong</h2><p>${String(err.message).replace(/</g, '&lt;')}</p></div></div>`;
    }
    return;
  }
  location.hash = '#/';
}

export function start() {
  addEventListener('hashchange', render);
  render();
}
