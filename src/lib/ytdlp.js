import { spawn } from 'node:child_process';
import { config } from '../config.js';

/** Run yt-dlp and return stdout. Rejects with stderr on failure. */
export function ytdlp(args, { timeout = 45_000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(config.ytDlpPath, ['--no-warnings', '--no-playlist', ...args], { windowsHide: true });
    } catch (err) {
      return reject(err);
    }
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error('yt-dlp not found. Run `npm run setup` or set YT_DLP_PATH.') : e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.replace(/^﻿/, ''));
      else reject(new Error(err.trim().split('\n').pop() || `yt-dlp exited with ${code}`));
    });
  });
}

/**
 * Resolve a direct audio URL for anything yt-dlp understands.
 * @returns {Promise<{url:string, headers:Record<string,string>, ext:string, mime:string, size?:number, duration?:number, protocol:string}>}
 */
export async function resolveAudio(pageUrl, format = 'bestaudio[ext=m4a]/bestaudio[acodec=opus]/bestaudio') {
  const info = JSON.parse(await ytdlp(['-f', format, '-j', pageUrl]));
  const ext = info.ext || 'm4a';
  return {
    url: info.url,
    headers: info.http_headers || {},
    ext,
    mime: ext === 'webm' ? 'audio/webm' : ext === 'mp3' ? 'audio/mpeg' : ext === 'opus' ? 'audio/ogg' : 'audio/mp4',
    size: info.filesize || info.filesize_approx || undefined,
    duration: info.duration,
    protocol: info.protocol || 'https',
  };
}
