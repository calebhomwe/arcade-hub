import { decodePNG } from './pnglib.mjs';
import fs from 'node:fs';
for (const f of ['eevee','cycles']) {
  const img = decodePNG(fs.readFileSync('./_probe_out/' + f + '.png'));
  const i = (32*img.width + 32) * 4;
  console.log(f, img.width+'x'+img.height, 'colorType', img.colorType, 'rgba', img.data[i], img.data[i+1], img.data[i+2], img.data[i+3]);
}
