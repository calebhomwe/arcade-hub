// make-study.mjs -- human-comparison receipts for the knight rebuild.
//  * renders-256/<id>.png      256px copies of all 12 sprites
//  * _boardstrip.png           pieces at real board size on chess.com green
//  * <pieces>/_knight_study.png old vs new knight, large, side by side
// stdlib only (pnglib.mjs).  Usage:
//   node make-study.mjs <piecesDir> <oldWDir> <oldBDir>
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, alphaBBox, encodePNG } from './pnglib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PIECES = process.argv[2] || 'C:/Users/caleb/AppData/Local/arcade-hub/games/assets/pieces';
const OLD_W = process.argv[3] || path.join(HERE, '_old_w_knight.png');
const OLD_B = process.argv[4] || path.join(HERE, '_old_b_knight.png');
const ORDER = ['pawn', 'bishop', 'knight', 'rook', 'queen', 'king'];
const IDS = [];
for (const c of ['w', 'b']) for (const p of ORDER) IDS.push(c + '_' + p);

const FONT = {
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01110','10001','10000','10000','10000','10001','01110'], D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01110','10001','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['01110','00100','00100','00100','00100','00100','01110'], J:['00111','00010','00010','00010','00010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','10001','11001','10101','10011','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','11011','10001'], X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11111','00010','00100','00010','00001','10001','01110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','11110','00001','00001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00010','01100'],
  '_':['00000','00000','00000','00000','00000','00000','11111'], '-':['00000','00000','00000','11111','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','01100','01100'], ':':['00000','01100','01100','00000','01100','01100','00000'],
  '/':['00001','00010','00010','00100','01000','01000','10000'], '=':['00000','00000','11111','00000','11111','00000','00000'],
  '+':['00000','00100','00100','11111','00100','00100','00000'], 'X2':['00000','00000','00000','00000','00000','00000','00000'],
};

class Canvas {
  constructor(w, h, bg) {
    this.w = w; this.h = h;
    this.data = new Uint8Array(w * h * 4);
    if (bg) this.fill(0, 0, w, h, bg);
  }
  put(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4, k = a / 255, ia = 1 - k;
    this.data[i] = Math.round(r * k + this.data[i] * ia);
    this.data[i+1] = Math.round(g * k + this.data[i+1] * ia);
    this.data[i+2] = Math.round(b * k + this.data[i+2] * ia);
    this.data[i+3] = 255;
  }
  fill(x0, y0, w, h, [r, g, b]) { for (let y=y0; y<y0+h; y++) for (let x=x0; x<x0+w; x++) this.put(x, y, r, g, b, 255); }
  rect(x0, y0, w, h, c) { this.fill(x0, y0, w, h, c); }
  text(x, y, str, scale, [r, g, b]) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch] || FONT[' '];
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++)
        if (g[row][col] === '1') this.fill(cx + col*scale, y + row*scale, scale, scale, [r, g, b]);
      cx += 6 * scale;
    }
    return cx;
  }
  // scaled draw of an RGBA sprite (nearest-neighbour, alpha composited)
  sprite(img, dx, dy, dw, dh) {
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = Math.min(img.width-1, Math.floor(x * img.width / dw));
      const sy = Math.min(img.height-1, Math.floor(y * img.height / dh));
      const i = (sy * img.width + sx) * 4;
      this.put(dx + x, dy + y, img.data[i], img.data[i+1], img.data[i+2], img.data[i+3]);
    }
  }
  // crop a sub-rectangle of an RGBA sprite and draw it scaled
  crop(img, sx0, sy0, sw, sh, dx, dy, dw, dh) {
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = sx0 + Math.min(sw-1, Math.floor(x * sw / dw));
      const sy = sy0 + Math.min(sh-1, Math.floor(y * sh / dh));
      const i = (sy * img.width + sx) * 4;
      this.put(dx + x, dy + y, img.data[i], img.data[i+1], img.data[i+2], img.data[i+3]);
    }
  }
  png() { return encodePNG(this.w, this.h, this.data); }
}

function resize(img, n) {
  if (img.width === n * 2 && img.height === n * 2) return halve(img).data;
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sx = Math.min(img.width - 1, Math.floor((x + 0.5) * img.width / n));
    const sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / n));
    const i = (sy * img.width + sx) * 4, o = (y * n + x) * 4;
    out[o] = img.data[i]; out[o+1] = img.data[i+1]; out[o+2] = img.data[i+2]; out[o+3] = img.data[i+3];
  }
  return out;
}

function halve(img) {
  const w = img.width >> 1, h = img.height >> 1, out = new Uint8Array(w*h*4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sr=0, sg=0, sb=0, sa=0;
    for (let dy=0; dy<2; dy++) for (let dx=0; dx<2; dx++) {
      const i = ((y*2+dy)*img.width + (x*2+dx)) * 4, a = img.data[i+3];
      sr += img.data[i]*a; sg += img.data[i+1]*a; sb += img.data[i+2]*a; sa += a;
    }
    const o = (y*w+x)*4;
    if (sa > 0) { out[o]=Math.round(sr/sa); out[o+1]=Math.round(sg/sa); out[o+2]=Math.round(sb/sa); out[o+3]=Math.round(sa/4); }
  }
  return { width: w, height: h, data: out };
}

// ---------------- load ----------------
const imgs = {};
for (const id of IDS) imgs[id] = decodePNG(fs.readFileSync(path.join(PIECES, id + '.png')));
const boxes = {};
for (const id of IDS) boxes[id] = alphaBBox(imgs[id], 8);
const kingH = boxes['w_king'].h;

// ---------------- 256px copies ----------------
const out256 = path.join(HERE, 'renders-256');
fs.mkdirSync(out256, { recursive: true });
for (const id of IDS) fs.writeFileSync(path.join(out256, id + '.png'), encodePNG(256, 256, resize(imgs[id], 256)));

// ---------------- board strip ----------------
const SQ = 48;                       // 48px square -> king = 1.04*48 ~ 50px
const GH = [118, 150, 86];           // chess.com green
const CREAM = [238, 238, 210];
const DARKBG = [26, 30, 35];
const PAD = 16, LAB = 18;
const ZOOMS = [50, 75, 112, 168];
const zoomW = ZOOMS.reduce((s, z) => s + z + 14, 0);
const W = Math.max(PAD + 12*SQ + 2*PAD, PAD*2 + zoomW);
const H = PAD + LAB + 2*SQ + 14 + LAB + 190 + PAD;
const c = new Canvas(W, H, DARKBG);
const WHITE = [235, 238, 243], GREY = [150, 160, 175];
c.text(PAD, 4, 'BOARD SIZE  KING = 1.04 X 48PX SQUARE', 2, WHITE);
// 12 pieces, 2 rows (white row / black row), each square alternating so every
// piece is judged on both a light and a dark square.
for (let r = 0; r < 2; r++) {
  const col = r === 0 ? WHITE : [235,235,238];
  c.text(PAD, PAD + LAB - 16 + r*SQ + SQ + 2, r === 0 ? 'WHITE' : 'BLACK', 1, GREY);
  for (let i = 0; i < 6; i++) {
    const id = (r === 0 ? 'w_' : 'b_') + ORDER[i];
    const b = boxes[id];
    const sx = PAD + i * SQ, sy = PAD + LAB + r * SQ;
    c.fill(sx, sy, SQ, SQ, ((i + r) % 2 === 0) ? GH : CREAM);
    const k = (SQ * 1.04) / kingH;
    const dw = Math.max(1, Math.round(b.w * k)), dh = Math.max(1, Math.round(b.h * k));
    c.sprite(imgs[id], Math.round(sx + (SQ - dw) / 2), Math.round(sy + SQ - 1 - dh), dw, dh);
  }
}
// zoom ladder: the white and black knight at 50 / 75 / 112 / 168 px tall
const zy = PAD + LAB + 2*SQ + 14;
c.text(PAD, zy, 'KNIGHT ZOOMS  ' + ZOOMS.join(' / ') + ' PX', 2, WHITE);
let zx = PAD;
for (const z of ZOOMS) {
  const bw = boxes['w_knight'], bb = boxes['b_knight'];
  const kw = z / bw.h, kh = z / bb.h;
  c.sprite(imgs['w_knight'], zx, zy + LAB, Math.round(bw.w * kw), z);
  c.sprite(imgs['b_knight'], zx + Math.round(bw.w * kw) + 8, zy + LAB, Math.round(bb.w * kh), z);
  c.text(zx, zy + LAB + 176, z + 'PX', 1, GREY);
  zx += z + Math.round(bw.w * kw) + 8 + 14;
}
fs.writeFileSync(path.join(HERE, '_boardstrip.png'), c.png());

// ---------------- knight study ----------------
const oldW = decodePNG(fs.readFileSync(OLD_W));
const oldB = decodePNG(fs.readFileSync(OLD_B));
const newW = imgs['w_knight'], newB = imgs['b_knight'];
const PANEL = [232, 235, 240], BG = [24, 27, 32];
const H2 = 720, W2 = 1180;
const s = new Canvas(W2, H2, BG);
s.text(24, 20, 'KNIGHT STUDY  V2 (OLD)  VS  V3 (NEW)', 3, [255,255,255]);
s.text(24, 50, 'FROM _LOOP/BLENDER BUILD-PIECES.PY - SAME CAMERA, SCALE AND LIGHTS', 2, [150,160,175]);
const drawBig = (img, cx, cy, maxH) => {
  const b = alphaBBox(img, 8);
  const k = maxH / b.h, dw = Math.round(b.w * k), dh = Math.round(b.h * k);
  const x = Math.round(cx - dw/2), y = Math.round(cy - dh/2);
  s.rect(x - 12, y - 12, dw + 24, dh + 24, PANEL);
  s.sprite(img, x, y, dw, dh);
  return { b, k, x, y, dw, dh };
};
// old pair
s.text(150, 96, 'V2 OLD', 3, [255,120,120]);
drawBig(oldW, 150, 300, 300); drawBig(oldB, 150, 610, 300);
// new pair
s.text(560, 96, 'V3 NEW', 3, [120,255,150]);
const nb = drawBig(newW, 560, 300, 300); drawBig(newB, 560, 610, 300);
// head close-ups
s.text(900, 96, 'NEW HEAD 2X', 2, [150,220,255]);
{
  const b = alphaBBox(newW, 8);
  const hx = b.x + Math.round(b.w * 0.34), hy = b.y, hw = Math.round(b.w * 0.66), hh = Math.round(b.h * 0.52);
  const dw = hw * 2, dh = hh * 2;
  s.rect(900 - 8, 130, dw + 16, dh + 16, PANEL);
  s.crop(newW, hx, hy, hw, hh, 900, 138, dw, dh);
}
s.text(900, 560, 'BOARD-SIZE 50PX', 2, [150,220,255]);
{
  const b = alphaBBox(newW, 8);
  const k = 50 / b.h;
  s.sprite(newW, 900, 600, Math.max(1, Math.round(b.w*k)), 50);
  s.sprite(newB, 900 + Math.round(b.w*k) + 10, 600, Math.max(1, Math.round(b.w*k)), 50);
}
fs.writeFileSync(path.join(PIECES, '_knight_study.png'), s.png());
console.log('wrote', path.join(PIECES, '_knight_study.png'), s.w + 'x' + s.h);
console.log('wrote', path.join(HERE, '_boardstrip.png'), W + 'x' + H);
console.log('wrote 12 x 256px copies to', out256);
