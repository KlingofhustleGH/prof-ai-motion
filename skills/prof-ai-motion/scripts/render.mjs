#!/usr/bin/env node
// PROF AI Motion renderer: serves the work folder, drives a headless Chromium, calls window.renderFrame(t, rt) per frame.
//
//   node render.mjs stills 0.5,1.8,3.2   [--dir work] [--comp comp.html] [--w 1080 --h 1920]
//   node render.mjs full                 [--dur 20] [--fps 30] [--out frames]
//   node render.mjs wstills 0.5,2.9      (times are REAL video times; uses warp.json)
//   node render.mjs wfull                (all frames through warp.json)
//
// Needs Playwright in the work folder:  npm i -D playwright && npx playwright install chromium
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(opt('dir', 'work'));
const COMP = opt('comp', 'comp.html');
const W = +opt('w', 1080), H = +opt('h', 1920), FPS = +opt('fps', 30);
const OUT = path.join(ROOT, opt('out', 'frames'));

const req = createRequire(path.join(ROOT, 'noop.js'));
let chromium;
for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = req(m)); break; } catch {} }
if (!chromium) { console.error('Playwright не найден. В папке work: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/${COMP}`);
try { await page.waitForFunction(() => window.renderFrame && window.ready, null, { timeout: 60000 }); }
catch { console.error('Композиция не загрузилась:', errors); process.exit(1); }
await page.evaluate(() => window.ready);

let WARP = null;
if (mode.startsWith('w')) WARP = JSON.parse(fs.readFileSync(path.join(ROOT, 'warp.json'), 'utf8'));
const tauOf = rt => { if (!WARP) return rt; const T = rt + WARP.Ts; let s = WARP.SEG[0];
  for (const x of WARP.SEG) { s = x; if (T <= x.T1) break; } return (s.b0 + (T - s.T0) / s.per) * WARP.beat; };
async function shot(rt, file, type) {
  await page.evaluate(([t, r]) => window.renderFrame(t, r), [tauOf(rt), rt]);
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

if (mode === 'stills' || mode === 'wstills') {
  const dir = path.join(ROOT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  for (const [i, t] of argv[1].split(',').map(Number).entries()) await shot(t, path.join(dir, `${String(i).padStart(2, '0')}_${t.toFixed(2)}.png`), 'png');
  console.log('stills →', dir);
} else if (mode === 'full' || mode === 'wfull') {
  fs.mkdirSync(OUT, { recursive: true });
  const N = WARP ? WARP.N : Math.round(+opt('dur', 20) * FPS);
  for (let i = 0; i < N; i++) { await shot(i / FPS, path.join(OUT, `${String(i).padStart(4, '0')}.jpg`), 'jpeg'); if (i % 100 === 0) console.log('frame', i, '/', N); }
  console.log('frames →', OUT, N);
} else { console.error('режим: stills | full | wstills | wfull'); process.exit(1); }
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); srv.close();
