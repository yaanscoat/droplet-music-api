import { api, streamUrl } from './api.js';
import { keyOf, toast } from './ui.js';

const STORAGE_KEY = 'music.player.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Queue + playback engine around one <audio> element.
 * Events: 'track' (current track changed), 'state' (play/pause/loading), 'queue', 'time', 'mode'.
 */
class Player extends EventTarget {
  constructor(audio) {
    super();
    this.audio = audio;
    this.queue = [];
    this.order = []; // indices into queue, shuffled when shuffle is on
    this.pos = -1; // position in `order`
    this.shuffle = false;
    this.repeat = 'off'; // 'off' | 'all' | 'one'
    this.state = 'idle'; // 'idle' | 'loading' | 'playing' | 'paused'
    this.failures = 0;

    const saved = load();
    this.audio.volume = saved.volume ?? 0.8;
    this.audio.muted = !!saved.muted;
    this.shuffle = !!saved.shuffle;
    this.repeat = saved.repeat || 'off';
    if (Array.isArray(saved.queue) && saved.queue.length) {
      this.queue = saved.queue;
      this.order = saved.order?.length === saved.queue.length ? saved.order : saved.queue.map((_, i) => i);
      this.pos = Math.min(saved.pos ?? 0, this.order.length - 1);
      this.resumeAt = saved.time || 0;
    }

    this.#bindAudio();
    this.#bindMediaSession();
  }

  get current() {
    return this.queue[this.order[this.pos]] || null;
  }

  /** Tracks that will play after the current one, in play order. */
  get upNext() {
    return this.order.slice(this.pos + 1).map((i) => this.queue[i]);
  }

  // ── public API ──────────────────────────────────────────────────────────
  /** Replace the queue with `tracks` and start at `index`. */
  playList(tracks, index = 0, { shuffle } = {}) {
    if (!tracks.length) return;
    if (shuffle !== undefined) this.shuffle = shuffle;
    this.queue = tracks.map((t) => ({ ...t }));
    this.order = this.queue.map((_, i) => i);
    if (this.shuffle) {
      const start = shuffle && index === 0 ? Math.floor(Math.random() * tracks.length) : index;
      this.order = [start, ...shuffled(this.order.filter((i) => i !== start))];
      this.pos = 0;
    } else {
      this.pos = index;
    }
    this.#emit('queue');
    this.#emit('mode');
    this.#load(true);
  }

  playTrack(track) {
    this.playList([track], 0);
  }

  /** Insert right after the current track. */
  playNext(track) {
    if (!this.current) return this.playTrack(track);
    this.queue.push({ ...track });
    this.order.splice(this.pos + 1, 0, this.queue.length - 1);
    this.#emit('queue');
    this.#save();
    toast(`“${track.title}” will play next`);
  }

  addToQueue(tracks) {
    tracks = [].concat(tracks);
    if (!this.current) return this.playList(tracks, 0);
    for (const t of tracks) {
      this.queue.push({ ...t });
      this.order.push(this.queue.length - 1);
    }
    this.#emit('queue');
    this.#save();
    toast(tracks.length === 1 ? `Added “${tracks[0].title}” to queue` : `Added ${tracks.length} songs to queue`);
  }

  /** Jump to the n-th item of `upNext`. */
  jumpTo(offset) {
    this.pos = Math.min(this.pos + 1 + offset, this.order.length - 1);
    this.#load(true);
  }

  toggle() {
    if (!this.current) return;
    if (!this.audio.src || this.audio.dataset.key !== keyOf(this.current)) return this.#load(true);
    if (this.audio.paused) this.audio.play().catch((e) => this.#onPlayError(e));
    else this.audio.pause();
  }

  next({ auto = false } = {}) {
    if (!this.queue.length) return;
    if (auto && this.repeat === 'one') {
      this.audio.currentTime = 0;
      return this.audio.play();
    }
    if (this.pos < this.order.length - 1) {
      this.pos++;
    } else if (this.repeat === 'all') {
      this.pos = 0;
    } else {
      // End of the queue with repeat off.
      if (auto) this.#setState('paused');
      return;
    }
    this.#load(true);
  }

  prev() {
    if (this.audio.currentTime > 3 || this.pos === 0) {
      this.audio.currentTime = 0;
      return;
    }
    this.pos--;
    this.#load(true);
  }

  seek(seconds) {
    if (Number.isFinite(seconds)) this.audio.currentTime = Math.max(0, seconds);
  }

  setVolume(v) {
    this.audio.volume = Math.min(1, Math.max(0, v));
    if (this.audio.volume > 0) this.audio.muted = false;
    this.#save();
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.#save();
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    const cur = this.order[this.pos];
    if (this.shuffle) {
      const rest = shuffled(this.order.filter((_, i) => i !== this.pos));
      this.order = [cur, ...rest];
      this.pos = 0;
    } else {
      this.order = this.queue.map((_, i) => i);
      this.pos = Math.max(0, cur);
    }
    this.#emit('queue');
    this.#emit('mode');
    this.#save();
  }

  cycleRepeat() {
    this.repeat = { off: 'all', all: 'one', one: 'off' }[this.repeat];
    this.#emit('mode');
    this.#save();
  }

  // ── internals ──────────────────────────────────────────────────────────
  #load(autoplay) {
    const track = this.current;
    if (!track) return;
    const a = this.audio;
    a.src = streamUrl(track);
    a.dataset.key = keyOf(track);
    if (this.resumeAt) {
      a.currentTime = this.resumeAt;
      this.resumeAt = 0;
    }
    this.#setState('loading');
    this.#emit('track');
    this.#updateMediaSession();
    this.#save();
    if (autoplay) a.play().catch((e) => this.#onPlayError(e));
  }

  #onPlayError(err) {
    if (err?.name === 'NotAllowedError') this.#setState('paused'); // autoplay blocked; wait for a click
    else if (err?.name !== 'AbortError') console.warn(err);
  }

  #bindAudio() {
    const a = this.audio;
    a.addEventListener('playing', () => {
      this.failures = 0;
      this.#setState('playing');
      this.#prefetchNext();
    });
    a.addEventListener('pause', () => this.state !== 'loading' && this.#setState('paused'));
    a.addEventListener('waiting', () => this.#setState('loading'));
    a.addEventListener('ended', () => this.next({ auto: true }));
    a.addEventListener('timeupdate', () => {
      this.#emit('time');
      // Save the position now and then so a reload can resume.
      if (Math.floor(a.currentTime) % 5 === 0) this.#save();
    });
    a.addEventListener('progress', () => this.#emit('time'));
    a.addEventListener('durationchange', () => this.#emit('time'));
    a.addEventListener('volumechange', () => this.#emit('mode'));
    a.addEventListener('error', () => {
      if (!a.src || !this.current) return;
      const t = this.current;
      this.failures++;
      toast(`Couldn't play “${t.title}”. No match found or the source is blocked.`, { type: 'error', duration: 4500 });
      this.#setState('paused');
      // Skip ahead, but don't spin through an entire broken queue.
      if (this.failures < 3 && this.pos < this.order.length - 1) setTimeout(() => this.next(), 1200);
    });
  }

  #bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action, fn) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    set('play', () => this.toggle());
    set('pause', () => this.toggle());
    set('previoustrack', () => this.prev());
    set('nexttrack', () => this.next());
    set('seekto', (e) => this.seek(e.seekTime));
    set('seekbackward', (e) => this.seek(this.audio.currentTime - (e.seekOffset || 10)));
    set('seekforward', (e) => this.seek(this.audio.currentTime + (e.seekOffset || 10)));
  }

  #updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.current) return;
    const t = this.current;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album?.title || '',
      artwork: t.cover ? [{ src: t.cover, sizes: '512x512' }] : [],
    });
  }

  /** Resolve the next track's audio in the background so it starts instantly. */
  #prefetchNext() {
    const next = this.queue[this.order[this.pos + 1]];
    if (next) api.resolve(next, true).catch(() => {});
  }

  #setState(state) {
    if (this.state === state) return;
    this.state = state;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state === 'playing' ? 'playing' : 'paused';
    this.#emit('state');
  }

  #emit(type) {
    this.dispatchEvent(new Event(type));
  }

  #save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          volume: this.audio.volume,
          muted: this.audio.muted,
          shuffle: this.shuffle,
          repeat: this.repeat,
          queue: this.queue.slice(0, 500),
          order: this.queue.length <= 500 ? this.order : undefined,
          pos: this.pos,
          time: this.audio.currentTime || 0,
        }),
      );
    } catch {
      /* storage full or blocked; not critical */
    }
  }
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const player = new Player(document.getElementById('audio'));
