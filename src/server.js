import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config, ROOT } from './config.js';
import artRoutes from './routes/art.js';
import catalogRoutes from './routes/catalog.js';
import libraryRoutes from './routes/library.js';
import streamRoutes from './routes/stream.js';

// Only warnings and errors from Fastify itself; per-request logs are noise for a personal server.
const app = Fastify({ logger: { level: 'warn' } });

app.setErrorHandler((err, req, reply) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) req.log.error(err);
  reply.code(status).send({ error: err.message });
});

app.register(artRoutes);
app.register(catalogRoutes);
app.register(streamRoutes);
app.register(libraryRoutes);
app.register(fastifyStatic, { root: join(ROOT, 'public'), index: 'index.html' });

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
  return reply.sendFile('index.html');
});

if (!existsSync(config.ytDlpPath) && config.ytDlpPath !== 'yt-dlp') {
  app.log.warn(`yt-dlp not found at ${config.ytDlpPath}`);
}

await app.listen({ port: config.port, host: config.host });
console.log(`Search:   ${config.searchProviders.join(' → ')}`);
console.log(`Playback: ${config.playbackProviders.join(' → ')}`);
console.log(`💧 Droplet is up → http://localhost:${config.port}`);
