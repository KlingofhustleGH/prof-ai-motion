#!/usr/bin/env node
// A/B click test for the beat phase. On dense, compressed mixes (constant sub-bass, LRA < 3) detectors disagree by up
// to ~0.1 s and Claude cannot hear. Render the same excerpt with clicks on each candidate grid; a human picks the one
// that sits on the kick.
//   node clicktest.mjs track.mp3 --beat 0.5 --phases 0.332,0.436 --from 4 --dur 8 --out work/clicktest
//   → clicktest-A.wav, clicktest-B.wav (+ .mp4 with a flashing square, if you want to watch it)
import { execFileSync } from 'node:child_process';
const argv = process.argv.slice(2), src = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const beat = +opt('beat', .5), phases = opt('phases', '0').split(',').map(Number), from = +opt('from', 0), dur = +opt('dur', 8), out = opt('out', 'clicktest');
phases.forEach((ph, i) => {
  const L = 'ABCDEF'[i], ticks = [];
  for (let k = 0; ; k++) { const t = ph + k * beat; if (t < from) continue; if (t > from + dur) break; ticks.push(((t - from) * 1000).toFixed(0)); }
  // a 30 ms 2.5 kHz click at every candidate beat, on top of the excerpt
  const clicks = ticks.map((ms, j) => `[c${j}]adelay=${ms}|${ms}[d${j}]`).join(';');
  const gen = ticks.map((_, j) => `sine=f=2500:d=0.03,volume=0.6,aformat=channel_layouts=stereo[c${j}]`).join(';');
  const mix = `[0:a]atrim=${from}:${from + dur},asetpts=N/SR/TB,volume=0.8[m];${gen};${clicks};[m]${ticks.map((_, j) => `[d${j}]`).join('')}amix=inputs=${ticks.length + 1}:normalize=0:duration=first[o]`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-filter_complex', mix, '-map', '[o]', `${out}-${L}.wav`]);
  console.log(`${out}-${L}.wav — фаза ${ph} с, доля ${beat} с, щелчков ${ticks.length}`);
});
console.log('Послушай оба: где щелчок совпадает с бочкой — та фаза и верная. Её ставь в BEAT0 (с поправкой на начало ролика).');
