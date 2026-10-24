import * as catalog from '../providers/search/index.js';

const SOURCES = ['tidal', 'ytmusic', 'soundcloud'];

export default async function catalogRoutes(app) {
  app.get('/api/search', async (req, reply) => {
    const q = String(req.query.q || '').trim();
    if (!q) return reply.code(400).send({ error: 'Missing ?q=' });
    const source = req.query.source && String(req.query.source);
    if (source && !catalog.providers[source]) return reply.code(400).send({ error: `Unknown source "${source}"` });
    return catalog.search(q, { source });
  });

  app.get('/api/suggest', async (req) => {
    const q = String(req.query.q || '').trim();
    return q ? catalog.suggestions(q).catch(() => []) : [];
  });

  app.get('/api/home', async () => ({ sections: await catalog.home() }));

  app.get('/api/album/:source/:id', async (req, reply) => {
    if (!SOURCES.includes(req.params.source)) return reply.code(400).send({ error: 'Unknown source' });
    return catalog.album(req.params.source, req.params.id);
  });

  app.get('/api/artist/:source/:id', async (req, reply) => {
    if (!SOURCES.includes(req.params.source)) return reply.code(400).send({ error: 'Unknown source' });
    return catalog.artist(req.params.source, req.params.id);
  });

  app.get('/api/playlist/:id', async (req) => catalog.playlist(req.params.id));

  app.get('/api/status', async () => ({ search: catalog.status() }));
}
