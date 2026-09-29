#!/usr/bin/env node
// Contact sheets for studying references and for QA of your own render.
//   node sheet.mjs video.mp4 out.jpg                       → overview: 20 frames spread over the whole clip
//   node sheet.mjs video.mp4 out.jpg --ss 3 --dur 5 --fps 12 --cols 10   → dense: see easing, blur, how text moves frame by frame
// 10–12 fps is enough to see a «paw» curve: 3–6 frames of almost nothing, 1–2 smeared frames, a long settle.
import { execFileSync } from 'node:child_process';
const [src, out, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
if (!src || !out) { console.error('usage: sheet.mjs video out.jpg [--ss s --dur s --fps n --cols n]'); process.exit(1); }
const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).toString().trim().split(',').map(Number);
const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString();
const tw = w >= h ? 320 : 180;
const dense = rest.includes('--fps');
const ss = +opt('ss', 0), len = +opt('dur', dense ? Math.min(5, dur - ss) : dur), fps = dense ? +opt('fps', 12) : 20 / len, cols = +opt('cols', dense ? 10 : 5);
const n = Math.ceil(len * fps), rows = Math.ceil(n / cols);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(ss), '-t', String(len), '-i', src, '-vf', `fps=${fps},scale=${tw}:-1,tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', out]);
console.log(out, `${n} кадров`, dense ? `(${fps} fps с ${ss} с)` : '(обзор)');
