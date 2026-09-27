#!/usr/bin/env node
// Per-video-frame spectrum (32 log bands 40 Hz–12 kHz, 0..255) and waveform (128 points, −127..127) of the FINAL mix.
//   ffmpeg -i mix.wav -ac 1 -ar 48000 -f f32le work/mono.raw
//   node analyze.mjs work/mono.raw <frames> [fps]   → work/assets/spectrum.json
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(process.argv[2] || 'work/mono.raw');
const NF = +process.argv[3], FPS = +(process.argv[4] || 30), SR = 48000, WIN = 2048, NB = 32;
if (!NF) { console.error('укажи число кадров'); process.exit(1); }
const raw = fs.readFileSync(file); const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const h = i + k + len / 2, vr = re[h] * cr - im[h] * ci, vi = re[h] * ci + im[h] * cr; re[h] = re[i + k] - vr; im[h] = im[i + k] - vi; re[i + k] += vr; im[i + k] += vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } }
const edges = [...Array(NB + 1)].map((_, i) => 40 * Math.pow(12000 / 40, i / NB));
const bands = [], wave = [];
for (let f = 0; f < NF; f++) {
  const c = Math.floor(f / FPS * SR), re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let i = 0; i < WIN; i++) re[i] = (x[c - WIN / 2 + i] || 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / WIN));
  fft(re, im); const row = [];
  for (let b = 0; b < NB; b++) { const k0 = Math.max(1, Math.floor(edges[b] / SR * WIN)), k1 = Math.max(k0 + 1, Math.floor(edges[b + 1] / SR * WIN)); let e = 0;
    for (let k = k0; k < k1; k++) e = Math.max(e, Math.hypot(re[k], im[k]));
    row.push(Math.round(Math.max(0, Math.min(1, (20 * Math.log10(e + 1e-9) + 10) / 50)) * 255)); }
  bands.push(row);
  const w = []; for (let i = 0; i < 128; i++) w.push(Math.round((x[c + Math.floor(i * SR / FPS / 128)] || 0) * 127)); wave.push(w);
}
const out = path.join(path.dirname(file), 'assets', 'spectrum.json'); fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ fps: FPS, bands, wave }));
console.log('кадров', NF, '→', out);
