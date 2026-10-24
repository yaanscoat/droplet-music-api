// Downloads the latest yt-dlp binary into ./bin so playback works without a global install.
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const assets = {
  win32: 'yt-dlp.exe',
  darwin: 'yt-dlp_macos',
  linux: process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux',
};

const asset = assets[process.platform];
if (!asset) {
  console.error(`No prebuilt yt-dlp for ${process.platform}. Install it yourself and set YT_DLP_PATH.`);
  process.exit(1);
}

const bin = resolve(import.meta.dirname, '..', 'bin');
const target = join(bin, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

console.log(`Downloading ${url}`);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
await mkdir(bin, { recursive: true });
await writeFile(target, Buffer.from(await res.arrayBuffer()));
if (process.platform !== 'win32') await chmod(target, 0o755);
console.log(`yt-dlp saved to ${target}`);
