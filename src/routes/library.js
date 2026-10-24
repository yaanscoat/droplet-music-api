import { join } from 'node:path';
import { DATA_DIR } from '../config.js';
import { JsonStore } from '../lib/store.js';

const library = new JsonStore(join(DATA_DIR, 'library.json'), { likes: [] });

const keyOf = (t) => `${t.source}:${t.id}`;

// Only keep the fields the UI needs to render and play a track.
function clean(t) {
  const { id, source, title, artist, artists, album, duration, cover, explicit } = t;
  return { id: String(id), source, title, artist, artists, album, duration, cover, explicit, likedAt: Date.now() };
}

export default async function libraryRoutes(app) {
  app.get('/api/library/likes', async () => {
    const { likes } = await library.load();
    return { likes };
  });

  app.put('/api/library/likes', async (req, reply) => {
    const t = req.body;
    if (!t?.id || !t?.source || !t?.title) return reply.code(400).send({ error: 'Body must be a track with id, source and title' });
    return library.update((data) => {
      data.likes = data.likes.filter((x) => keyOf(x) !== keyOf(t));
      data.likes.unshift(clean(t));
      return { liked: true, count: data.likes.length };
    });
  });

  app.delete('/api/library/likes/:source/:id', async (req) =>
    library.update((data) => {
      const key = `${req.params.source}:${req.params.id}`;
      data.likes = data.likes.filter((x) => keyOf(x) !== key);
      return { liked: false, count: data.likes.length };
    }),
  );
}
