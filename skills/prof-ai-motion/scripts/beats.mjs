#!/usr/bin/env node
// Beat grid of a music track.
//   ffmpeg -i track.mp3 -ac 1 -ar 22050 -f f32le work/track.raw
//   node beats.mjs work/track.raw            → work/kickgrid.json  { a, P, beat, bpm, entry }
// Prints: tempo candidates, on-beat vs off-beat check, robust kick fit, energy profile around the beat entry.
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(process.argv[2] || 'work/track.raw');
const SR = 22050, HOP = 256, WIN = 1024;
const raw = fs.readFileSync(file); const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const h = i + k + len / 2, vr = re[h] * cr - im[h] * ci, vi = re[h] * ci + im[h] * cr; re[h] = re[i + k] - vr; im[h] = im[i + k] - vi; re[i + k] += vr; im[i + k] += vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } }

// 1. onset envelope
const nF = Math.floor((x.length - WIN) / HOP), fps = SR / HOP;
let prev = new Float64Array(WIN / 2); const onset = new Float64Array(nF);
for (let f = 0; f < nF; f++) { const re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let i = 0; i < WIN; i++) re[i] = x[f * HOP + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / WIN));
  fft(re, im); let fl = 0; const mag = new Float64Array(WIN / 2);
  for (let k = 1; k < WIN / 2; k++) { mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k])); const d = mag[k] - prev[k]; if (d > 0) fl += d; }
  prev = mag; onset[f] = fl; }
const on = onset.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 16); j < Math.min(nF, i + 16); j++) { s += onset[j]; c++; } return Math.max(0, v - s / c); });

// 2. tempo candidates (autocorrelation)
const sc = []; for (let bpm = 60; bpm <= 200; bpm += .1) { const lag = 60 / bpm * fps; let s = 0;
  for (let i = 0; i + Math.ceil(lag * 4) < nF; i++) { const j = i + lag, j0 = Math.floor(j), fr = j - j0; s += on[i] * (on[j0] * (1 - fr) + on[j0 + 1] * fr); } sc.push([bpm, s]); }
const peaks = []; for (const [b, s] of sc.slice().sort((a, b) => b[1] - a[1])) { if (peaks.every(p => Math.abs(p[0] - b) > 3)) peaks.push([b, s]); if (peaks.length === 5) break; }
console.log('кандидаты темпа:', peaks.map(p => p[0].toFixed(1)).join(' '));

// 3. kick onsets (low-passed energy rises) and robust linear fit
const H2 = 110; let lp = 0; const e = []; for (let i = 0; i + H2 < x.length; i += H2) { let s = 0; for (let k = 0; k < H2; k++) { lp += .02 * (x[i + k] - lp); s += lp * lp; } e.push(Math.sqrt(s / H2)); }
const dt = H2 / SR, kicks = []; let last = -1; const thr = Math.max(...e) * .12;
for (let i = 3; i < e.length; i++) { if (e[i] - e[i - 3] > thr && i * dt - last > .25) { kicks.push(i * dt); last = i * dt; } }
const slowest = peaks.map(p => p[0]).filter(b => b >= 60).sort((a, b) => a - b)[0];
let P = 60 / slowest, a = kicks[0] || 0;
for (let it = 0; it < 6; it++) {
  const pts = kicks.map(t => { const k = Math.round((t - a) / P); return [k, t, t - (a + P * k)]; }).filter(p => Math.abs(p[2]) < (it < 2 ? .1 : .05));
  if (pts.length < 4) break;
  const n = pts.length, sk = pts.reduce((s, p) => s + p[0], 0), st = pts.reduce((s, p) => s + p[1], 0), skk = pts.reduce((s, p) => s + p[0] * p[0], 0), skt = pts.reduce((s, p) => s + p[0] * p[1], 0);
  P = (n * skt - sk * st) / (n * skk - sk * sk); a = (st - P * sk) / n;
  if (it === 5) console.log(`бочка: ${(60 / P).toFixed(2)} BPM, фаза ${a.toFixed(3)} с, точек ${n}, разброс ${Math.max(...pts.map(p => Math.abs(p[1] - (a + P * p[0])))).toFixed(3)} с`);
}
a = ((a % P) + P) % P;

// 4. self-check: onset strength on the grid vs half-way between
let lp2 = 0; const env = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { lp2 += .02 * (x[i] - lp2); env[i] = Math.abs(lp2); }
const rise = t => { const i = Math.floor(t * SR); let s1 = 0, s0 = 0; for (let k = 0; k < 700; k++) { s1 += env[i + k] || 0; s0 += env[i - 700 + k] || 0; } return s1 - s0; };
const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const onB = [], offB = []; for (let t = a; t < x.length / SR - 1; t += P) { onB.push(rise(t)); offB.push(rise(t + P / 2)); }
console.log(`проверка фазы: на долях ${mean(onB).toFixed(2)}, между долями ${mean(offB).toFixed(2)} ${mean(onB) > mean(offB) ? '✓' : '✗ фаза сдвинута на полдоли — проверь вручную'}`);

// 5. entry: first kick after which low energy stays high
const lowAt = t => { const i = Math.floor(t / dt); let s = 0; for (let k = 0; k < Math.round(P / dt); k++) s += e[i + k] || 0; return s; };
const bars = []; for (let t = a; t < x.length / SR - P; t += P) bars.push([t, lowAt(t)]);
const med = bars.map(b => b[1]).sort((p, q) => p - q)[Math.floor(bars.length / 2)];
const entry = (bars.find((b, i) => b[1] > med * .8 && (bars[i + 1] || b)[1] > med * .8) || bars[0])[0];
console.log('вход бита ≈', entry.toFixed(3), 'с');

const out = path.join(path.dirname(file), 'kickgrid.json');
fs.writeFileSync(out, JSON.stringify({ a, P, beat: P / 2, bpm: 60 / P, entry }));
console.log('→', out);
