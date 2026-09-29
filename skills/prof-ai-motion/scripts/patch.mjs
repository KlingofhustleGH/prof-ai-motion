#!/usr/bin/env node
// Re-render only a range of frames after a small fix (no need to re-render the whole video), then re-mux.
//   node patch.mjs 55 67 --dir work [--comp reel.html --w 1920 --h 1080]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2);
const [a, b] = argv.slice(0, 2).map(Number);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const dir = path.resolve(opt('dir', 'work')), fps = +opt('fps', 30);
const render = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render.mjs');
const times = []; for (let i = a; i <= b; i++) times.push((i / fps).toFixed(4));
execFileSync('node', [render, 'stills', times.join(','), '--dir', dir, '--comp', opt('comp', 'comp.html'), '--w', opt('w', '1920'), '--h', opt('h', '1080')], { stdio: 'inherit' });
fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
const st = fs.readdirSync(path.join(dir, 'stills')).filter(f => f.endsWith('.png')).sort();
st.forEach((f, k) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(dir, 'stills', f), '-q:v', '2', path.join(dir, 'frames', `${String(a + k).padStart(4, '0')}.jpg`)]));
console.log('перерисованы кадры', a, '→', b, '— теперь пересобери mp4');
