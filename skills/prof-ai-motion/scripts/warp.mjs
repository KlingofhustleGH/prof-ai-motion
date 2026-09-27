#!/usr/bin/env node
// Time map: composition beats → track time. The composition is written on its own grid (default 120 BPM, beat 0.5 s).
//   node warp.mjs work/kickgrid.json --segments 0:4:kick,4:60:beat,60:68:kick --land 4 [--entry 3.36] [--comp-beat 0.5] [--tail 0.5]
// kick = one composition beat per kick of the track (slower), beat = per half-kick (denser).
// --land: composition beat that must hit the track's beat entry (e.g. the logo landing).
// → work/warp.json { Ts, SEG:[{b0,b1,per,T0,T1}], beat, N, dur }
import fs from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const gridFile = path.resolve(argv[0] || 'work/kickgrid.json');
const G = JSON.parse(fs.readFileSync(gridFile, 'utf8'));
const segs = opt('segments', '0:4:kick,4:60:beat,60:68:kick').split(',').map(s => { const [b0, b1, k] = s.split(':'); return { b0: +b0, b1: +b1, per: k === 'kick' ? G.P : G.P / 2 }; });
const land = +opt('land', 4), compBeat = +opt('comp-beat', .5), tail = +opt('tail', .5), fps = +opt('fps', 30);
let entry = +opt('entry', G.entry); entry = G.a + Math.round((entry - G.a) / G.P) * G.P;   // snap to a kick
// place segments so that composition beat `land` sits on `entry`
let T = 0; const SEG = segs.map(s => ({ ...s })); for (const s of SEG) { s.T0 = T; T += (s.b1 - s.b0) * s.per; s.T1 = T; }
const Tland = (() => { for (const s of SEG) if (land <= s.b1) return s.T0 + (land - s.b0) * s.per; })();
const shift = entry - Tland; for (const s of SEG) { s.T0 += shift; s.T1 += shift; }
if (SEG[0].T0 < 0) console.warn('⚠ начало ролика раньше начала трека — уменьши --land или выбери вход позже');
const Ts = Math.max(0, SEG[0].T0 - 2 / fps);
const dur = SEG[SEG.length - 1].T1 - Ts + tail, N = Math.round(dur * fps);
const out = path.join(path.dirname(gridFile), 'warp.json');
fs.writeFileSync(out, JSON.stringify({ Ts, SEG, beat: compBeat, N, dur }));
console.log(`вход ${entry.toFixed(3)} · начать трек с ${Ts.toFixed(3)} с · ${dur.toFixed(2)} с · ${N} кадров`);
SEG.forEach(s => console.log(`  доли ${s.b0}–${s.b1} по ${s.per.toFixed(4)} с: трек ${s.T0.toFixed(2)}–${s.T1.toFixed(2)}`));
console.log('→', out);
