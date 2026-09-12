import { decodePNG } from './pnglib.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync(process.argv[2]));
const { width, height, data } = img;
const rows = [];
for (let y = 0; y < height; y++) {
  let best = 0, start = -1;
  for (let x = 0; x < width; x++) {
    const a = data[(y*width+x)*4+3] > 8;
    if (a && start < 0) start = x;
    if (!a && start >= 0) { best = Math.max(best, x-start); start = -1; }
  }
  if (start >= 0) best = Math.max(best, width-start);
  rows.push(best);
}
const top = rows.findIndex(v=>v>0);
let bot = height-1; while (rows[bot]===0) bot--;
console.log('top row', top, 'bottom row', bot, 'height', bot-top+1);
for (let y = top; y <= bot; y += 10) {
  const frac = (bot - y + 1) / (bot - top + 1);
  console.log('y='+String(y).padStart(3), 'h_from_base='+(frac*100).toFixed(0).padStart(3)+'%', 'width='+String(rows[y]).padStart(3), '#'.repeat(Math.round(rows[y]/6)));
}
