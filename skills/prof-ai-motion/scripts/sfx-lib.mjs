// SFX library: unpitched effects that sit on any track. Import, place events, write a WAV.
//
//   import { Mix, timeMap } from './sfx-lib.mjs';
//   const at = timeMap('work/warp.json');           // or: const at = t => t;  (no warp)
//   const m = new Mix(30);                           // seconds
//   m.boom(at(2.0)); m.whoosh(at(5.0)); m.clicks(at(6), 10, .04);
//   m.write('work/sfx.wav');
import fs from 'node:fs';

export function timeMap(warpFile) {
  const W = JSON.parse(fs.readFileSync(warpFile, 'utf8'));
  return tau => { const b = tau / W.beat; let s = W.SEG[0]; for (const x of W.SEG) { s = x; if (b <= x.b1 + 1e-9) break; }
    return s.T0 + (b - s.b0) * s.per - W.Ts; };
}

export class Mix {
  constructor(seconds, SR = 48000) {
    this.SR = SR; this.N = Math.ceil(seconds * SR);
    this.dry = [new Float32Array(this.N), new Float32Array(this.N)]; this.wet = [new Float32Array(this.N), new Float32Array(this.N)];
    this.seed = 11;
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647 * 2 - 1; }
  add(i, l, r, send = 0) { if (i >= 0 && i < this.N) { this.dry[0][i] += l; this.dry[1][i] += r; if (send) { this.wet[0][i] += l * send; this.wet[1][i] += r * send; } } }
  noiseHP(t, dur, g, cutoff, pan = 0, send = 0) { const SR = this.SR, a = Math.floor(t * SR), len = Math.floor(dur * SR); let lp = 0; const k = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
    for (let j = 0; j < len; j++) { const n = this.rnd(); lp += k * (n - lp); const s = (n - lp) * g * Math.exp(-j / SR / (dur / 4)); this.add(a + j, s * (1 - pan), s * (1 + pan), send); } }
  noiseBP(t, dur, g, fc, pan = 0, send = .3, shape) { const SR = this.SR, a = Math.floor(t * SR), len = Math.floor(dur * SR); let l1 = 0, l2 = 0;
    for (let j = 0; j < len; j++) { const p = j / len, f = typeof fc === 'function' ? fc(p) : fc, k = 1 - Math.exp(-2 * Math.PI * f / SR); l1 += k * (this.rnd() - l1); l2 += k * (l1 - l2);
      const s = (l1 - l2) * 3 * g * (shape ? shape(p) : Math.exp(-p * 5)); this.add(a + j, s * (1 - pan), s * (1 + pan), send); } }
  /** low impact with falling pitch */
  boom(t, g = .9) { const SR = this.SR, a = Math.floor(t * SR); let ph = 0; for (let j = 0; j < SR; j++) { const u = j / SR, f = 30 + 80 * Math.exp(-u / .06); ph += 2 * Math.PI * f / SR; const s = Math.sin(ph) * g * Math.exp(-u / .35); this.add(a + j, s, s, .1); } }
  /** bright noise hit (pairs with boom) */
  hit(t, g = .35) { this.noiseBP(t, .25, g, 2500, 0, .5); }
  /** swell rising into t1 */
  riser(t0, t1, g = .25) { this.noiseBP(t0, t1 - t0, g, p => 300 + 7000 * p * p, 0, .4, p => Math.pow(p, 2.2)); }
  /** pass-by centred on t */
  whoosh(t, g = .3) { this.noiseBP(t - .22, .5, g, p => 500 + 6000 * Math.sin(Math.PI * p), 0, .4, p => Math.sin(Math.PI * p) ** 2); }
  click(t, g = .08) { this.noiseHP(t, .012, g, 3000, this.rnd() * .4, .1); }
  clicks(t, n, step, g = .07) { for (let k = 0; k < n; k++) this.click(t + k * step, g); }
  tick(t, g = .12, pan = 0) { this.noiseBP(t, .05, g, 4200, pan, .3, p => Math.exp(-p * 9)); }
  glitch(t, dur = .2, g = .12) { const SR = this.SR, a = Math.floor(t * SR), len = Math.floor(dur * SR); let f = 200;
    for (let j = 0; j < len; j++) { if (j % 900 === 0) f = 120 + Math.abs(this.rnd()) * 1800; const s = (Math.sin(2 * Math.PI * f * j / SR) > 0 ? 1 : -1) * g * (1 - j / len); this.add(a + j, s * .8, s, .1); } }
  sparkle(t, dur, g = .05) { for (let i = 0; i < 26; i++) this.tick(t + Math.abs(this.rnd()) * dur, g * (.4 + Math.abs(this.rnd())), this.rnd() * .8); }
  shatter(t, g = .06) { for (let i = 0; i < 30; i++) { const u = t + .02 + Math.pow(Math.abs(this.rnd()), 1.6) * .7; this.tick(u, g, this.rnd()); this.noiseHP(u, .02, g * .8, 5000, this.rnd() * .6); } }
  filmRattle(t0, t1, g = .02) { for (let t = t0; t < t1; t += 1 / 24) this.noiseHP(t, .01, g, 4000, .3); }

  write(file) {
    const { N, SR } = this;
    const reverb = (x, o) => { const y = new Float32Array(N); const cs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: d + o, b: new Float32Array(d + o), i: 0, lp: 0 }));
      for (let n = 0; n < N; n++) { let s = 0; for (const c of cs) { const v = c.b[c.i]; c.lp = v * .6 + c.lp * .4; c.b[c.i] = x[n] + c.lp * .8; c.i = (c.i + 1) % c.d; s += v; } y[n] = s / 6; }
      for (const d of [225 + o, 556 + o]) { const b = new Float32Array(d); let i = 0; for (let n = 0; n < N; n++) { const v = b[i]; const w = y[n] + v * .5; b[i] = w; y[n] = v - w * .5; i = (i + 1) % d; } } return y; };
    const rv = [reverb(this.wet[0], 0), reverb(this.wet[1], 23)];
    const buf = Buffer.alloc(44 + N * 8);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 8, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(N * 8, 40);
    for (let n = 0; n < N; n++) for (const c of [0, 1]) buf.writeFloatLE(Math.tanh((this.dry[c][n] + rv[c][n] * .6) * 1.1), 44 + n * 8 + c * 4);
    fs.writeFileSync(file, buf); console.log('sfx →', file);
  }
}
