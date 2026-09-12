import { decodePNG, alphaBBox } from './pnglib.mjs';
import fs from 'node:fs';
const dir = process.argv[2];
for (const f of ['w_pawn.png','b_pawn.png','w_king.png']) {
  const img = decodePNG(fs.readFileSync(dir + '/' + f));
  let cov = 0, maxA = 0, maxRGB = 0, minRGB = 255;
  for (let i = 0; i < img.width*img.height; i++) {
    const a = img.data[i*4+3];
    if (a > 8) cov++;
    if (a > maxA) maxA = a;
  }
  // ascii overview 64x64
  const rows = [];
  for (let ry = 0; ry < 32; ry++) {
    let line = '';
    for (let rx = 0; rx < 64; rx++) {
      let s = 0, n = 0;
      for (let y = ry*16; y < ry*16+16; y++) for (let x = rx*8; x < rx*8+8; x++) { s += img.data[(y*img.width+x)*4+3]; n++; }
      const m = s/n;
      line += m > 200 ? '#' : m > 100 ? '+' : m > 40 ? '.' : m > 8 ? ',' : ' ';
    }
    rows.push(line);
  }
  console.log('===', f, img.width+'x'+img.height, 'colorType', img.colorType, 'coverage>8:', (cov/(img.width*img.height)*100).toFixed(2)+'%', 'maxAlpha', maxA);
  console.log('bbox>8:', JSON.stringify(alphaBBox(img, 8)), 'bbox>32:', JSON.stringify(alphaBBox(img, 32)), 'bbox>128:', JSON.stringify(alphaBBox(img, 128)));
  console.log(rows.join('\n'));
}
