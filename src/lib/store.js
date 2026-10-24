import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** A JSON file on disk with serialized, atomic writes. Good enough for a single-user self-hosted app. */
export class JsonStore {
  constructor(file, defaults) {
    this.file = file;
    this.defaults = defaults;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.data) return this.data;
    try {
      this.data = { ...structuredClone(this.defaults), ...JSON.parse(await readFile(this.file, 'utf8')) };
    } catch {
      this.data = structuredClone(this.defaults);
    }
    return this.data;
  }

  /** Mutate the data with `fn`, persist it, and return what `fn` returned. */
  update(fn) {
    const run = async () => {
      const data = await this.load();
      const result = await fn(data);
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, this.file);
      return result;
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
}
