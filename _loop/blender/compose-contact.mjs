// compose-contact.mjs -- build _contact.png: all 12 sprites on a labelled grid,
// plus a board-scale strip (king = 1.04 * square) and a silhouette comparison row.
// stdlib only (pnglib.mjs).  Usage: node compose-contact.mjs [piecesDir]
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, alphaBBox, encodePNG } from './pnglib.mjs';

const DIR = process.argv[2] || 'C:/Users/caleb/AppData/Local/arcade-hub/games/assets/pieces';
const ORDER = ['pawn', 'bishop', 'knight', 'rook', 'queen', 'king'];
const IDS = [];
for (const c of ['w', 'b']) for (const p of ORDER) IDS.push(c + '_' + p);

const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
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
};

const M = 18, HEADER = 52, CELL = 256, GAP = 18, LBL = 30, COLS = 6, ROWS = 2;
const SHEET_W = 2*M + COLS*CELL + (COLS-1)*GAP;
const GRID_H = ROWS*(CELL+LBL) + (ROWS-1)*GAP;
const SQ = 48;                              // board square size in px
const SIL = 126, SIL_GAP = 6;               // silhouette row cell size
const SIL_W = 12*SIL + 11*SIL_GAP;
const TITLE_H = 30, STRIP_H = 2*SQ + 10, STRIP_TITLE = 26, SIL_TITLE = 26;
const SHEET_H = M + HEADER + GRID_H + 24 + STRIP_TITLE + STRIP_H + 24 + SIL_TITLE + SIL + M;

const BG = [20, 23, 27], CELLBG = [185, 192, 200], CELLBD = [120, 128, 138];
const TXT = [232, 236, 241], TITLE = [255, 255, 255];
const LIGHT_SQ = [240, 217, 181], DARK_SQ = [181, 136, 99];
const canvas = new Uint8Array(SHEET_W * SHEET_H * 4);
for (let i = 0; i < SHEET_W * SHEET_H; i++) { canvas[i*4]=BG[0]; canvas[i*4+1]=BG[1]; canvas[i*4+2]=BG[2]; canvas[i*4+3]=255; }

const put = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= SHEET_W || y >= SHEET_H || a <= 0) return;
  const i = (y*SHEET_W + x) * 4;
  const k = a / 255, ia = 1 - k;
  canvas[i]   = Math.round(r*k + canvas[i]*ia);
  canvas[i+1] = Math.round(g*k + canvas[i+1]*ia);
  canvas[i+2] = Math.round(b*k + canvas[i+2]*ia);
  canvas[i+3] = 255;
};
const fillRect = (x0, y0, w, h, [r,g,b]) => {
  for (let y = y0; y < y0+h; y++) for (let x = x0; x < x0+w; x++) put(x, y, r, g, b, 255);
};
function drawText(x, y, str, scale, [r,g,b]) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] || FONT['?'] || FONT[' '];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++)
      if (g[row][col] === '1') fillRect(cx + col*scale, y + row*scale, scale, scale, [r,g,b]);
    cx += 6*scale;
  }
  return cx;
}
const textW = (s, scale) => s.length * 6 * scale;

// 2x2 box downscale with premultiplied alpha (avoids dark fringes)
function halve(img) {
  const w = img.width >> 1, h = img.height >> 1, out = new Uint8Array(w*h*4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sr=0, sg=0, sb=0, sa=0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((y*2+dy)*img.width + (x*2+dx)) * 4;
      const a = img.data[i+3]; sr += img.data[i]*a; sg += img.data[i+1]*a; sb += img.data[i+2]*a; sa += a;
    }
    const o = (y*w+x)*4;
    if (sa > 0) { out[o]=Math.round(sr/sa); out[o+1]=Math.round(sg/sa); out[o+2]=Math.round(sb/sa); out[o+3]=Math.round(sa/4); }
  }
  return { width: w, height: h, data: out };
}
function drawImage(img, dx, dy, dw, dh, mode) {
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.width-1, Math.floor(x*img.width/dw));
    const sy = Math.min(img.height-1, Math.floor(y*img.height/dh));
    const i = (sy*img.width+sx)*4;
    const a = img.data[i+3];
    if (mode === 'silhouette') put(dx+x, dy+y, 22, 24, 28, a);
    else put(dx+x, dy+y, img.data[i], img.data[i+1], img.data[i+2], a);
  }
}

const imgs = {}, boxes = {};
for (const id of IDS) {
  const img = decodePNG(fs.readFileSync(path.join(DIR, id + '.png')));
  imgs[id] = img;
  boxes[id] = alphaBBox(img, 10);
}
const kingH = boxes['w_king'].h;

// ---- header -------------------------------------------------------------
drawText(M, M, 'ARCADE-HUB CHESS PIECES  V3', 3, TITLE);
drawText(M, M+30, '12 SPRITES 512X512 RGBA - ONE CAMERA / ONE SCALE / ONE BASELINE - EEVEE 512 TAA SAMPLES', 2, [150,160,175]);

// ---- sprite grid --------------------------------------------------------
const gridY = M + HEADER;
IDS.forEach((id, idx) => {
  const col = idx % COLS, row = (idx / COLS) | 0;
  const x = M + col*(CELL+GAP), y = gridY + row*(CELL+LBL+GAP);
  fillRect(x-2, y-2, CELL+4, CELL+4, CELLBD);
  fillRect(x, y, CELL, CELL, CELLBG);
  const small = halve(imgs[id]);
  drawImage(small, x, y, CELL, CELL);
  const label = id + '  H=' + boxes[id].h + 'PX';
  drawText(x, y+CELL+7, label, 2, TXT);
});

// ---- board-scale strip --------------------------------------------------
const stripY = gridY + GRID_H + 24;
drawText(M, stripY, 'BOARD SCALE - KING HEIGHT = 1.04 X 48PX SQUARE (AS DRAWN BY GAMES/CHESS.HTML)', 2, [150,160,175]);
const boardY = stripY + STRIP_TITLE;
const boardX = M + ((SHEET_W - 2*M) - 12*SQ) / 2;
for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
  // 12 squares per row: the 6 piece types twice, second pass on the other square
  // colour, so every piece is judged on BOTH a light and a dark square.
  const idUse = IDS[r*6 + (c % 6)];
  const sqCol = (((c % 6) + Math.floor(c / 6)) % 2 === 0) ? LIGHT_SQ : DARK_SQ;
  const sx = boardX + c*SQ, sy = boardY + r*SQ;
  fillRect(sx, sy, SQ, SQ, sqCol);
  const b = boxes[idUse];
  const k = (SQ * 1.04) / kingH;
  const dw = b.w*k, dh = b.h*k;
  drawImage(imgs[idUse], Math.round(sx + (SQ-dw)/2), Math.round(sy + SQ - 2 - dh), Math.round(dw), Math.round(dh));
}

// ---- silhouette row -----------------------------------------------------
const silY = boardY + STRIP_H + 24;
drawText(M, silY, 'SILHOUETTES AT EQUAL HEIGHT FAMILY SCALE - PROPORTION CHECK', 2, [150,160,175]);
const silTop = silY + SIL_TITLE;
const silX0 = M + ((SHEET_W - 2*M) - SIL_W) / 2;
IDS.forEach((id, idx) => {
  const x = silX0 + idx*(SIL+SIL_GAP);
  fillRect(x-1, silTop-1, SIL+2, SIL+2, [70,76,86]);
  fillRect(x, silTop, SIL, SIL, [214,219,225]);
  const b = boxes[id];
  const k = (SIL - 8) / b.h;
  const dw = b.w*k, dh = b.h*k;
  drawImage(imgs[id], Math.round(x + (SIL-dw)/2), Math.round(silTop + SIL - dh), Math.round(dw), Math.round(dh), 'silhouette');
});

const outPath = path.join(DIR, '_contact.png');
fs.writeFileSync(outPath, encodePNG(SHEET_W, SHEET_H, canvas));
console.log('wrote ' + outPath + '  ' + SHEET_W + 'x' + SHEET_H + '  ' + fs.statSync(outPath).size + ' bytes');
