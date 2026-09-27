#!/usr/bin/env node
// Downloads Google Fonts locally (cyrillic + latin) and writes fonts.css — rendering must not depend on the network.
//   node fonts.mjs work/assets/fonts "Unbounded:wght@700;900" "Golos Text:wght@400;600" "PT Mono" "DM Serif Display:ital@0;1"
import fs from 'node:fs';
import path from 'node:path';
const [dirArg, ...families] = process.argv.slice(2);
const dir = path.resolve(dirArg || 'work/assets/fonts'); fs.mkdirSync(dir, { recursive: true });
const fams = families.length ? families : ['Unbounded:wght@700;900', 'Golos Text:wght@400;600', 'PT Mono', 'DM Serif Display:ital@0;1'];
const url = 'https://fonts.googleapis.com/css2?' + fams.map(f => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=block';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const css = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g)];
let n = 0; const out = [];
for (const [, subset, block] of blocks) {
  if (!['cyrillic', 'latin'].includes(subset)) continue;
  const src = block.match(/url\((.*?)\)/)[1]; const name = `f${++n}.woff2`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await (await fetch(src)).arrayBuffer()));
  out.push(block.replace(src, name));
}
fs.writeFileSync(path.join(dir, 'fonts.css'), out.join('\n'));
console.log(n, 'файлов шрифтов →', dir);
