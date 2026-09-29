#!/usr/bin/env node
// Honest cutout check: every PNG in a folder composited (alpha!) over a flat colour, one sheet.
// Do NOT pad+tile RGBA into JPEG — alpha becomes black and every cutout looks broken.
//   node cutcheck.mjs work/assets/cut out.jpg [0xE8235B]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [dir, out, col = '0xE8235B'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
const inp = [], f = [];
files.forEach((n, i) => { inp.push('-i', `${dir}/${n}`); f.push(`color=${col}:s=320x320:d=1[b${i}];[${i}:v]format=rgba,scale=300:300:force_original_aspect_ratio=decrease[s${i}];[b${i}][s${i}]overlay=(W-w)/2:(H-h)/2[c${i}]`); });
const lay = files.map((_, i) => `${(i % 6) * 320}_${Math.floor(i / 6) * 320}`).join('|');
if (!files.length) { console.error('в папке нет PNG'); process.exit(1); }
const stack = files.length === 1 ? '[c0]null' : `${files.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${files.length}:layout=${lay}`;   // xstack needs ≥ 2 inputs
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inp, '-filter_complex', `${f.join(';')};${stack}`, '-frames:v', '1', out]);
console.log(out, files.length, 'вырезок');
