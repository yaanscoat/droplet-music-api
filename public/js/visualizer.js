// Spectrum bars under the big artwork, plus a --bass value the CSS uses to make the art "breathe".
// The audio is same-origin (/api/stream), so Web Audio is allowed to analyse it.
//
// Careful: once an <audio> element is routed through an AudioContext, a *suspended* context means
// silence. So we only create it from a user click (opening Now Playing) and resume it on every play.

let ctx = null;
let analyser = null;
let data = null;
let raf = 0;
let accent = '#ff6aa2';
let frame = 0;

function setup(audio) {
  if (ctx) return;
  ctx = new AudioContext();
  const source = ctx.createMediaElementSource(audio);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.78;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  data = new Uint8Array(analyser.frequencyBinCount);
  audio.addEventListener('play', () => ctx.resume());
}

function draw(canvas, wrap) {
  const g = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  analyser.getByteFrequencyData(data);
  if (frame++ % 30 === 0) accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || accent;

  // Bass drives the artwork pulse.
  let bass = 0;
  for (let i = 1; i < 7; i++) bass += data[i];
  wrap.style.setProperty('--bass', ((bass / 6 / 255) ** 2.2).toFixed(3));

  // Mirrored bars from the centre outwards, only the musically interesting low/mid range.
  const bars = 36;
  const gap = 4;
  const bw = (w - gap * (bars * 2 - 1)) / (bars * 2);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, accent);
  g.fillStyle = grad;
  for (let i = 0; i < bars; i++) {
    const v = data[Math.floor(2 + i * 1.6)] / 255;
    const bh = Math.max(3, v ** 1.4 * h);
    const y = (h - bh) / 2;
    const xr = w / 2 + gap / 2 + i * (bw + gap);
    const xl = w / 2 - gap / 2 - (i + 1) * bw - i * gap;
    g.globalAlpha = 0.35 + v * 0.65;
    g.beginPath();
    g.roundRect(xr, y, bw, bh, bw / 2);
    g.roundRect(xl, y, bw, bh, bw / 2);
    g.fill();
  }
  g.globalAlpha = 1;
  raf = requestAnimationFrame(() => draw(canvas, wrap));
}

export function startVisualizer(audio, canvas, wrap) {
  try {
    setup(audio);
    ctx.resume();
  } catch (err) {
    console.warn('Visualizer unavailable:', err);
    return;
  }
  cancelAnimationFrame(raf);
  draw(canvas, wrap);
}

export function stopVisualizer() {
  cancelAnimationFrame(raf);
  raf = 0;
}
