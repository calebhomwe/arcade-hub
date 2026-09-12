import { decodePNG } from './pnglib.mjs';
import fs from 'node:fs';
const files = process.argv.slice(2);
for (const f of files) {
  const img = decodePNG(fs.readFileSync(f));
  const lum = [];
  for (let i = 0; i < img.width*img.height; i++) {
    const a = img.data[i*4+3];
    if (a > 200) {
      const r = img.data[i*4], g = img.data[i*4+1], b = img.data[i*4+2];
      lum.push(0.2126*r + 0.7152*g + 0.0722*b);
    }
  }
  lum.sort((x,y)=>x-y);
  const q = p => lum[Math.min(lum.length-1, Math.floor(lum.length*p))].toFixed(0);
  const clipped = lum.filter(v=>v>=252).length/lum.length*100;
  const dark = lum.filter(v=>v<=20).length/lum.length*100;
  console.log(f.split(/[\\/]/).pop().padEnd(14), 'n='+lum.length, 'p05='+q(0.05), 'p25='+q(0.25), 'p50='+q(0.5), 'p75='+q(0.75), 'p95='+q(0.95),
    'clipped='+clipped.toFixed(1)+'%', 'near-black='+dark.toFixed(1)+'%');
}
