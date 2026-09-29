/* PROF AI Motion — canvas engine (classic script, globals). Proven on a 19 s showreel: flat 2.5D + photo cutouts + video.
   Contract: the page defines SCENES = [[startSec, fn(g, t)], ...] and calls boot({...}); render.mjs calls window.renderFrame(t).
   Laws baked in (see references/motion-dna.md):
   • every move uses paw() — slow → very fast → slow; P(t, at) puts the fastest moment exactly on `at` (a beat);
   • walk()/pong() give every visible element a new paw step on every beat — nothing ever stands still;
   • renderFrame averages N sub-frames over a 180° shutter = real motion blur on fast moves, crisp holds. */

var W = 1920, H = 1080, FPS = 30;
var BEAT0 = 0.232, BEAT = 0.5;                 // set from kickgrid.json: first beat in VIDEO time, beat length
var SUBFRAMES = 6, SHUTTER = 0.5;              // 6 sub-frames, 180° shutter (fraction of a frame)
var FF = '"Inter Tight"';                      // default font family (bold grotesk, no serif, no italic)

var clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k, prog = (t, a, d) => clamp((t - a) / d);
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => { x = clamp(x); let t = x; for (let i = 0; i < 10; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) break; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; } return sy(clamp(t)); }; }
var paw = bez(.87, 0, .13, 1);                 // «мягкие лапы»: the house curve for EVERY move
var out = bez(.16, 1, .3, 1);                  // only for things that must react instantly (flash decay, strike line)
var B = k => BEAT0 + BEAT * k;
var P = (t, at, d = .36) => paw(prog(t, at - d / 2, d));
/** random walk of paw steps inside [t0,t1], one step per `step` s — the «never still» engine */
function walk(t, t0, t1, seed, amp, step = BEAT, d = .34) { let v = 0; for (let b = t0; b <= t1 + 1e-6; b += step) { if (b > t + d) break; v += (hash(seed * 7.31 + b * 3.7) - .5) * 2 * amp * paw(prog(t, b - d / 2, d)); } return v; }
/** ping-pong: +amp / back on every step */
function pong(t, t0, t1, amp, step = BEAT, d = .34) { let v = 0, s = 1; for (let b = t0; b <= t1 + 1e-6; b += step) { if (b > t + d) break; v += s * amp * paw(prog(t, b - d / 2, d)); s = -s; } return v; }
var rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------- canvases ----------
var mkCanvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
var main, sub, G, tmpC, T, maskC, M;

// ---------- images: a collect pass finds every image a frame touches, then waits for decode ----------
var COLLECT = false; var need = new Set(), IMC = new Map();
function IM(src) { let e = IMC.get(src); if (!e) { const img = new Image(); img.src = src; e = { img, ok: false }; e.p = img.decode().then(() => { e.ok = true; }).catch(() => { e.ok = true; }); IMC.set(src, e); } return e; }
function dimg(g, src, x, y, w, h, o = {}) { const e = IM(src); if (COLLECT) { need.add(src); return; } if (!e.ok) return; g.save(); if (o.a !== undefined) g.globalAlpha *= o.a; if (o.filter) g.filter = o.filter;
  g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1); g.drawImage(e.img, -w / 2, -h / 2, w, h); g.restore(); }
var asp = src => { const e = IM(src); return e.img.naturalWidth / (e.img.naturalHeight || 1) || 1; };
/** cutout PNG (assets/cut/<name>.png) drawn by height, anchored at its centre. filter:'brightness(0)' = black silhouette clone */
function cutout(g, name, x, y, h, o = {}) { const s = `assets/cut/${name}.png`; dimg(g, s, x, y, h * asp(s), h, o); }
function cover(g, src, x, y, w, h, zoom = 1, ax = .5, ay = .5, o = {}) { const e = IM(src); if (COLLECT) { need.add(src); return; } if (!e.ok) return; const iw = e.img.naturalWidth, ih = e.img.naturalHeight, s = Math.max(w / iw, h / ih) * zoom, dw = iw * s, dh = ih * s;
  g.save(); if (o.filter) g.filter = o.filter; g.drawImage(e.img, x + (w - dw) * ax, y + (h - dh) * ay, dw, dh); g.restore(); }
/** video frame path: frames extracted with ffmpeg -vf fps=30 → assets/<dir>/0001.jpg … */
var vf = (dir, sec, N) => `assets/${dir}/${String(clamp(Math.round(sec * 30) + 1, 1, N)).padStart(4, '0')}.jpg`;

// ---------- text ----------
function txt(g, s, x, y, size, o = {}) { const { w = 900, f = FF, col = '#fff', al = 'center', ls = -.03, a = 1, rot = 0, sc = 1, sx = 1, base = 'middle', stroke = 0 } = o; if (a <= .003 || Math.abs(sc) < .001) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc * sx, sc); g.globalAlpha *= a; g.font = `${w} ${size}px ${f}`; g.letterSpacing = (ls * size).toFixed(2) + 'px'; g.textAlign = al; g.textBaseline = base;
  if (stroke) { g.strokeStyle = col; g.lineWidth = stroke; g.strokeText(s, 0, 0); } else { g.fillStyle = col; g.fillText(s, 0, 0); } g.restore(); }
function tw(g, s, size, w = 900, f = FF, ls = -.03) { g.save(); g.font = `${w} ${size}px ${f}`; g.letterSpacing = (ls * size) + 'px'; const m = g.measureText(s).width; g.restore(); return m; }
function glyphs(g, s, size, w = 900, f = FF) { g.save(); g.font = `${w} ${size}px ${f}`; g.letterSpacing = '0px'; const o = []; let x = 0; for (const ch of s) { const cw = g.measureText(ch).width; o.push({ ch, x: x + cw / 2, w: cw }); x += cw * .97; } g.restore(); o.forEach(q => q.x -= x / 2); return o; }
/** per-letter drawing; fn(i, n, glyph) → {dx, dy, sc, rot, a, col, sx} */
function letters(g, s, cx, cy, size, fn, o = {}) { const gl = glyphs(g, s, size, o.w || 900, o.f || FF); gl.forEach((q, i) => { const r = fn(i, gl.length, q) || {};
  txt(g, q.ch, cx + q.x + (r.dx || 0), cy + (r.dy || 0), size, { w: o.w || 900, f: o.f || FF, col: r.col || o.col || '#fff', ls: 0, sc: r.sc ?? 1, rot: r.rot || 0, a: r.a ?? 1, sx: r.sx ?? 1, stroke: o.stroke || 0 }); }); }
/** «сборка по буквам»: letters fly in from scattered 3D positions, fastest moment ≈ at */
function assemble(g, t, at, s, cx, cy, size, o = {}) { const seed = o.seed || 1, st = o.stagger ?? .035; letters(g, s, cx, cy, size, (i, n) => { const p = P(t, at + (i - n / 2) * st, o.d || .5);
  return { dx: (hash(seed + i) - .5) * 1800 * (1 - p), dy: (hash(seed + i * 3) - .5) * 1100 * (1 - p), sc: lerp(2.6 + hash(i + seed) * 2, 1, p), rot: (hash(seed + i * 7) - .5) * 2.4 * (1 - p), a: clamp(p * 3) }; }, o); }
/** «схлоп → взрыв»: the word grows out of a point */
function burst(g, t, at, s, cx, cy, size, o = {}) { const e = P(t, at, o.d || .34); letters(g, s, cx, cy, size, (i, n) => ({ sc: lerp(.02, 1, e), rot: (1 - e) * (i - n / 2) * .3, a: clamp(e * 3) }), o); }
/** word that lands with a paw move and then keeps hopping on every beat. Defaults = the amplitudes that finally read as «alive» */
function word(g, t, at, s, x, y, size, o = {}) { if (t < at - .3) return; const p = P(t, at, o.d || .36), seed = o.seed || s.length * 3.3, t1 = o.until || 1e9;
  const hx = walk(t, at + BEAT, t1, seed, o.hx ?? 90), hy = walk(t, at + BEAT, t1, seed + 5, o.hy ?? 30), hs = walk(t, at + BEAT, t1, seed + 9, o.hs ?? .12), hr = walk(t, at + BEAT, t1, seed + 13, o.hr ?? .05), life = Math.max(0, t - at);
  txt(g, s, x + (o.dx ?? 0) * (1 - p) + hx, y + (o.dy ?? -160) * (1 - p) + hy, size, { ...o, a: (o.a ?? 1) * clamp(p * 1.8), sc: lerp(o.from ?? 2.2, 1, p) * (1 + hs) * (1 + life * (o.grow ?? .06)), ls: (o.ls ?? -.03) + life * (o.spread ?? .03), rot: (o.rot ?? .35) * (1 - p) + hr }); }
/** 3D ring of text around a vertical axis. Draw pass 'back' before the person and 'front' after. Letters narrow with cos(angle), back half mirrored + dimmed */
function ring(g, s, cx, cy, R, tilt, ang, size, col, pass, o = {}) { const gl = glyphs(g, s, size, o.w || 900); const circ = gl.reduce((a, q) => a + q.w * .97, 0); const rr = Math.max(R, circ / (2 * Math.PI)); let acc = 0;
  for (const q of gl) { const a = ang + (acc + q.w / 2) / rr; acc += q.w * .97; const z = Math.cos(a); if ((pass === 'front') !== (z >= 0)) continue; const x = cx + Math.sin(a) * R, y = cy + z * R * tilt, sc = (1 + z * .28) * (o.sc ?? 1);
    txt(g, q.ch, x, y, size, { w: o.w || 900, col, ls: 0, sc, sx: Math.abs(z) < .05 ? .05 * Math.sign(z || 1) : z, a: (o.a ?? 1) * (z >= 0 ? 1 : .42) }); } }
/** footage visible only inside the letters. Build the whole mask first, then ONE destination-in (per-letter destination-in erases the previous letters) */
function videoInLetters(g, src, drawLetters, zoom = 1.1, ax = .5, ay = .4) { T.setTransform(1, 0, 0, 1, 0, 0); T.globalCompositeOperation = 'source-over'; T.clearRect(0, 0, W, H); cover(T, src, 0, 0, W, H, zoom, ax, ay);
  if (COLLECT) return; M.setTransform(1, 0, 0, 1, 0, 0); M.clearRect(0, 0, W, H); drawLetters(M, '#fff'); T.globalCompositeOperation = 'destination-in'; T.drawImage(maskC, 0, 0); T.globalCompositeOperation = 'source-over'; g.drawImage(tmpC, 0, 0); }
/** extruded (pseudo-3D) letters: stacked offset copies + front face */
function extruded(g, s, x, y, size, rise, col = '#161517', side = ['#3a0f22', '#24101a'], depth = 26) { if (rise <= 0) return; const yy = y + (1 - rise) * size * 1.1;
  for (let i = depth; i > 0; i--) txt(g, s, x + i * 1.6, yy + i * 1.1, size, { w: 900, col: i > depth * .6 ? side[0] : side[1], ls: -.02, base: 'alphabetic' }); txt(g, s, x, yy, size, { w: 900, col, ls: -.02, base: 'alphabetic' }); }

// ---------- flat-shaded 3D (orthographic, painter-sorted) ----------
function rot3([x, y, z], rx, ry, rz) { let c = Math.cos(rx), s = Math.sin(rx);[y, z] = [y * c - z * s, y * s + z * c]; c = Math.cos(ry); s = Math.sin(ry);[x, z] = [x * c + z * s, -x * s + z * c]; c = Math.cos(rz); s = Math.sin(rz);[x, y] = [x * c - y * s, x * s + y * c]; return [x, y, z]; }
function shadeFaces(g, verts, faces, cx, cy, R, rx, ry, rz, ramp) { const v = verts.map(p => rot3(p, rx, ry, rz)), L = [-.45, .62, -.64], list = [];
  for (const f of faces) { const a = v[f[0]], b = v[f[1]], c = v[f[2]]; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); if (n[2] > 0) continue;
    list.push({ z: f.reduce((s, i) => s + v[i][2], 0) / f.length, pts: f.map(i => [cx + v[i][0] * R, cy - v[i][1] * R]), lum: clamp(n[0] * L[0] + n[1] * L[1] + n[2] * L[2], -1, 1) }); }
  list.sort((a, b) => b.z - a.z); for (const q of list) { g.beginPath(); q.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = ramp(q.lum); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = .8; g.stroke(); } }
/** crumpled paper ball (seeded noisy icosphere, 320 faces) */
var BALL = (() => { const t = (1 + Math.sqrt(5)) / 2; let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(q => q / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < 2; s++) { const m = new Map(), nf = []; const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!m.has(k)) { const p = v[a].map((q, i) => (q + v[b][i]) / 2), l = Math.hypot(...p); v.push(p.map(q => q / l)); m.set(k, v.length - 1); } return m.get(k); };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } f = nf; }
  v = v.map((p, i) => { const r = .78 + hash(i * 3.1) * .36; return p.map(q => q * r); }); return { v, f }; })();
function ball(g, x, y, R, rx, ry) { shadeFaces(g, BALL.v, BALL.f, x, y, R, rx, ry, 0, l => { const k = clamp(.42 + l * .75); return `rgb(${lerp(40, 236, k) | 0},${lerp(36, 230, k) | 0},${lerp(40, 212, k) | 0})`; }); }
/** hero ▶ prism (play button) */
var TRI = (() => { const Pp = [[1, 0], [-.55, .84], [-.55, -.84]], d = .2, v = []; for (const z of [-d, d]) for (const [x, y] of Pp) v.push([x, y, z]); return { v, f: [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]] }; })();
function prism(g, x, y, R, rx, ry, rz, a = 1) { if (R < 1) return; g.save(); g.globalAlpha *= a; shadeFaces(g, TRI.v, TRI.f, x, y, R, rx, ry, rz, l => { const k = clamp(.5 + l * .6); return `rgb(${lerp(150, 238, k) | 0},${lerp(60, 232, k) | 0},${lerp(85, 214, k) | 0})`; }); g.restore(); }

// ---------- decor ----------
function confetti(g, t, t0, x, y, n, seed, spread = 1, cols = ['#E8235B', '#E6DFCB']) { if (t < t0) return; const d = t - t0; if (d > 1.6) return;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (hash(seed + i) - .5) * 2.2 * spread, v = 500 + hash(seed + i * 7) * 900, px = x + Math.cos(a) * v * d * .9, py = y + Math.sin(a) * v * d + 700 * d * d, s = 7 + hash(seed + i * 5) * 13;
    g.save(); g.translate(px, py); g.rotate(d * (6 + hash(i) * 10)); g.globalAlpha *= clamp(1.4 - d); g.fillStyle = cols[i % cols.length]; g.fillRect(-s / 2, -s / 4, s, s / 2); g.restore(); } }
/** speed tunnel: streaks flying out of the centre */
function tunnel(g, t, n = 170, cols = [[22, 21, 23], [230, 223, 203]], cx = 960, cy = 540) { for (let i = 0; i < n; i++) { const a = hash(i) * Math.PI * 2, ph = (hash(i + 11) + t * (1.2 + hash(i + 5) * .9)) % 1, r0 = ph * ph * 1500, r1 = r0 + 30 + ph * ph * 560;
  g.strokeStyle = i % 4 ? rgba(cols[0], .25 + ph * .5) : rgba(cols[1], .2 + ph * .6); g.lineWidth = 1 + ph * 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); } }
function cloud(g, x, y, s, col) { g.fillStyle = col; g.beginPath(); for (const [dx, dy, r] of [[0, 0, 1], [.9, .2, .8], [-.9, .25, .75], [.4, -.45, .7], [-.4, -.35, .65], [1.6, .4, .5], [-1.6, .45, .5]]) { g.moveTo(x + dx * s + r * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); } g.fill(); }
function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function pill(g, x, y, w, h, { fill = null, stroke = null, lw = 3 } = {}) { g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
/** camera: scale/offset/rotate the whole layer around (cx, cy). Call inside save/restore */
function camera(g, cx, cy, s, dx = 0, dy = 0, rot = 0) { g.translate(cx + dx, cy + dy); g.rotate(rot); g.scale(s, s); g.translate(-cx, -cy); }
/** circular portal: draw(g) is clipped to the circle */
function portal(g, cx, cy, R, draw, edge = null, lw = 8) { if (R <= 1) return; g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); draw(g); g.restore(); if (edge) { g.strokeStyle = edge; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); } }
/** strips shutter: n horizontal strips slide in alternately (p 0 → 1 covers the frame) */
function shutter(g, p, col, n = 12) { if (p <= 0) return; g.fillStyle = col; const h = H / n; for (let i = 0; i < n; i++) g.fillRect((i % 2 ? 1 : -1) * W * (1 - p), i * h, W, h + 1); }

// ---------- frame loop ----------
var SCENES = [], FLASH = '#E6DFCB', SPEC = null;
function frame(g, t) { let s = SCENES[0][1]; for (const [a, f] of SCENES) if (t >= a) s = f; g.save(); s(g, t); g.restore();
  for (const [a] of SCENES.slice(1)) { const d = t - a; if (d >= 0 && d < 1 / FPS) { g.fillStyle = FLASH; g.globalAlpha = .85; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } } }  // 1-frame flash on every cut
var grains = [];
window.renderFrame = async (t) => { const sh = SHUTTER / FPS;
  COLLECT = true; need.clear(); for (const ts of [t, Math.max(0, t - sh)]) { G.setTransform(1, 0, 0, 1, 0, 0); frame(G, ts); } COLLECT = false; await Promise.all([...need].map(s => IM(s).p));
  main.globalCompositeOperation = 'source-over';
  for (let i = 0; i < SUBFRAMES; i++) { const ts = Math.max(0, t - sh * (i / (SUBFRAMES - 1))); G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.filter = 'none'; G.clearRect(0, 0, W, H); frame(G, ts); main.globalAlpha = 1 / (i + 1); main.drawImage(sub, 0, 0); }
  main.globalAlpha = .07; main.globalCompositeOperation = 'overlay'; main.drawImage(grains[Math.round(t * FPS) % 3], 0, 0, W, H); main.globalCompositeOperation = 'source-over'; main.globalAlpha = 1;
  const v = main.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .48, W / 2, H / 2, Math.max(W, H) * .62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.26)'); main.fillStyle = v; main.fillRect(0, 0, W, H); };

/** boot({canvas, scenes, fonts:['900 60px "Inter Tight"', …], cutouts:['alice', …], spectrum:true}) */
function boot(o) {
  if (o.size) { W = o.size[0]; H = o.size[1]; }
  main = o.canvas.getContext('2d'); sub = mkCanvas(); G = sub.getContext('2d'); tmpC = mkCanvas(); T = tmpC.getContext('2d'); maskC = mkCanvas(); M = maskC.getContext('2d');
  SCENES = o.scenes; if (o.flash) FLASH = o.flash; if (o.beat0 !== undefined) BEAT0 = o.beat0; if (o.beat) BEAT = o.beat;
  grains = [0, 1, 2].map(k => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; const q = c.getContext('2d'), d = q.createImageData(c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (hash(i * .37 + k * 1000) - .5) * 200; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } q.putImageData(d, 0, 0); return c; });
  window.ready = (async () => {
    if (o.spectrum) SPEC = await (await fetch('assets/spectrum.json')).json();
    for (const f of o.fonts || []) await document.fonts.load(f); await document.fonts.ready;
    // canvas resolves a font face on FIRST USE: without this warm-up frame 0 renders in a fallback serif
    for (const f of o.fonts || []) { G.font = f.replace(/\d+px/, '80px'); G.fillText('делегируй монтаж abc 0123', 10, 100); }
    await Promise.all((o.cutouts || []).map(n => IM(`assets/cut/${n}.png`).p));
    G.clearRect(0, 0, W, H); await new Promise(r => setTimeout(r, 300));
  })();
}
