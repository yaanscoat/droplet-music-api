/** Tiny in-memory TTL cache with in-flight de-duplication. */
export class TTLCache {
  constructor({ ttl = 10 * 60_000, max = 1000 } = {}) {
    this.ttl = ttl;
    this.max = max;
    this.map = new Map();
    this.pending = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttl = this.ttl) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expires: Date.now() + ttl });
    return value;
  }

  delete(key) {
    this.map.delete(key);
  }

  /** Return the cached value, or run `fn` once (even under concurrent calls) and cache its result. */
  async wrap(key, fn, ttl) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = (async () => {
      try {
        return this.set(key, await fn(), ttl);
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, promise);
    return promise;
  }
}
