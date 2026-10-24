import { request } from '../lib/http.js';

// Same-origin artwork proxy, so the browser can read pixel colours off covers for the ambient theme
// (canvas refuses to read cross-origin images). Only image CDNs we actually use are allowed;
// this is a cover-art proxy, not a free open proxy for the whole internet.
const ALLOWED = [/\.googleusercontent\.com$/, /\.ytimg\.com$/, /\.sndcdn\.com$/, /^resources\.tidal\.com$/];

export default async function artRoutes(app) {
  app.get('/api/art', async (req, reply) => {
    let url;
    try {
      url = new URL(String(req.query.u || ''));
    } catch {
      return reply.code(400).send({ error: 'Bad ?u=' });
    }
    if (url.protocol !== 'https:' || !ALLOWED.some((re) => re.test(url.hostname))) {
      return reply.code(403).send({ error: 'Host not allowed' });
    }
    const res = await request(url.href, { timeout: 10_000 });
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return reply.code(502).send({ error: 'Not an image' });
    reply.header('content-type', type);
    reply.header('cache-control', 'public, max-age=604800, immutable');
    return reply.send(Buffer.from(await res.arrayBuffer()));
  });
}
