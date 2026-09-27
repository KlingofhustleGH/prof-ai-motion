#!/usr/bin/env node
// Downloads Three.js + the addons PROF AI Motion uses, so rendering never touches the network.
//   node vendor-three.mjs work/assets/three [version]
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || 'work/assets/three');
const V = process.argv[3] || '0.170.0';
const B = `https://cdn.jsdelivr.net/npm/three@${V}`;
const files = {
  'three.module.js': `${B}/build/three.module.js`,
  'addons/environments/RoomEnvironment.js': `${B}/examples/jsm/environments/RoomEnvironment.js`,
  'addons/loaders/FontLoader.js': `${B}/examples/jsm/loaders/FontLoader.js`,
  'addons/geometries/TextGeometry.js': `${B}/examples/jsm/geometries/TextGeometry.js`,
  'helvetiker_bold.typeface.json': `${B}/examples/fonts/helvetiker_bold.typeface.json`,
};
for (const [rel, url] of Object.entries(files)) {
  const out = path.join(dir, rel); fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await fetch(url); if (!r.ok) { console.error('FAIL', url, r.status); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log('ok', rel);
}
console.log(`three@${V} →`, dir);
