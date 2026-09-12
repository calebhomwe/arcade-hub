
import { decodePNG, alphaBBox } from "./pnglib.mjs";
import fs from "node:fs";
import path from "node:path";
const A = process.argv[2], B = process.argv[3];
const ORDER = ['pawn','bishop','knight','rook','queen','king'];
const IDS = []; for (const c of ['w','b']) for (const p of ORDER) IDS.push(c+'_'+p);
console.log("id        maxAbs  meanAbs  nDiff  nDiff>2  nDiff>8  bboxA                bboxB");
for (const id of IDS) {
  const a = decodePNG(fs.readFileSync(path.join(A, id + '.png')));
  const b = decodePNG(fs.readFileSync(path.join(B, id + '.png')));
  let mx = 0, s = 0, n = 0, gt2 = 0, gt8 = 0;
  for (let i = 0; i < a.data.length; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d) { n++; s += d; if (d > gt2) gt2++; if (d > gt8) gt8++; if (d > mx) mx = d; }
  }
  const ba = JSON.stringify(alphaBBox(a, 8)), bb = JSON.stringify(alphaBBox(b, 8));
  console.log(id.padEnd(9) + String(mx).padStart(5) + String((s/(a.data.length)).toFixed(3)).padStart(9) + String(n).padStart(7) + String(gt2).padStart(9) + String(gt8).padStart(9) + '  ' + ba.padEnd(21) + bb + (ba===bb?'':'  BBOX-DIFF'));
}
