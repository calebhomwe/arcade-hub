'use strict';
// lc-chess.js - standalone legal chess engine for verifying games/chess.html learning content.
// Board encoding matches chess.html: index 0 = a8 ... 63 = h1; piece = (color<<3)|type.
const PT = { NONE:0, KING:1, QUEEN:2, ROOK:3, BISHOP:4, KNIGHT:5, PAWN:6 };
const CL = { WHITE:0, BLACK:1 };
const P = (t, c) => (c << 3) | t;
const pType = p => p & 7;
const pColor = p => (p >> 3) & 1;
const row = i => Math.floor(i / 8);
const col = i => i % 8;
const idx = (r, c) => r * 8 + c;
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sqName = i => String.fromCharCode(97 + col(i)) + (8 - row(i));
const nameSq = s => idx(8 - parseInt(s[1], 10), s.charCodeAt(0) - 97);

function parseFEN(fen) {
  const parts = String(fen).trim().split(/\s+/);
  const board = new Array(64).fill(0);
  const ranks = parts[0].split('/');
  if (ranks.length !== 8) throw new Error('bad FEN rank count: ' + ranks.length);
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') { c += parseInt(ch, 10); continue; }
      const color = ch === ch.toUpperCase() ? CL.WHITE : CL.BLACK;
      const map = { k:PT.KING, q:PT.QUEEN, r:PT.ROOK, b:PT.BISHOP, n:PT.KNIGHT, p:PT.PAWN };
      if (!(ch.toLowerCase() in map)) throw new Error('bad FEN char ' + ch);
      if (c > 7) throw new Error('rank overflow in ' + ranks[r]);
      board[idx(r, c)] = P(map[ch.toLowerCase()], color);
      c++;
    }
    if (c !== 8) throw new Error('rank ' + r + ' has ' + c + ' squares: ' + ranks[r]);
  }
  const turn = parts[1] === 'w' ? CL.WHITE : CL.BLACK;
  const cr = parts[2] || '-';
  const castle = { K: cr.includes('K'), Q: cr.includes('Q'), k: cr.includes('k'), q: cr.includes('q') };
  let ep = null;
  if (parts[3] && parts[3] !== '-') ep = nameSq(parts[3]);
  return { board, turn, castling: castle, ep, halfmove: parts[4] ? parseInt(parts[4],10) : 0, fullmove: parts[5] ? parseInt(parts[5],10) : 1 };
}

function toFEN(st) {
  let s = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = st.board[idx(r, c)];
      if (!p) { empty++; continue; }
      if (empty) { s += empty; empty = 0; }
      const L = '?kqrbnp'[pType(p)];
      s += pColor(p) === CL.WHITE ? L.toUpperCase() : L;
    }
    if (empty) s += empty;
    if (r < 7) s += '/';
  }
  let cr = (st.castling.K?'K':'') + (st.castling.Q?'Q':'') + (st.castling.k?'k':'') + (st.castling.q?'q':'');
  return s + ' ' + (st.turn === CL.WHITE ? 'w' : 'b') + ' ' + (cr || '-') + ' ' + (st.ep === null ? '-' : sqName(st.ep)) + ' ' + (st.halfmove||0) + ' ' + (st.fullmove||1);
}

function cloneSt(st) { return { board: st.board.slice(), turn: st.turn, castling: Object.assign({}, st.castling), ep: st.ep, halfmove: st.halfmove, fullmove: st.fullmove }; }

function pseudoMoves(b, i, ep, castle) {
  const p = b[i]; if (!p) return [];
  const type = pType(p), color = pColor(p);
  const r = row(i), c = col(i), enemy = 1 - color, out = [];
  const push = (tr, tc) => { if (inB(tr,tc)) { const t = idx(tr,tc), tp = b[t]; if (!tp || pColor(tp) === enemy) out.push({ from:i, to:t, capture:tp }); } };
  const slide = (dr, dc) => { for (let nr=r+dr, nc=c+dc; inB(nr,nc); nr+=dr, nc+=dc) { const t = idx(nr,nc), tp = b[t]; if (tp) { if (pColor(tp) === enemy) out.push({from:i,to:t,capture:tp}); break; } out.push({from:i,to:t,capture:0}); } };
  if (type === PT.PAWN) {
    const dir = color === CL.WHITE ? -1 : 1;
    const startR = color === CL.WHITE ? 6 : 1;
    const promoRank = color === CL.WHITE ? 0 : 7;
    if (inB(r+dir, c) && !b[idx(r+dir,c)]) {
      const to = idx(r+dir,c);
      if (r+dir === promoRank) { for (const pr of [PT.QUEEN,PT.ROOK,PT.BISHOP,PT.KNIGHT]) out.push({from:i,to,capture:0,promo:pr}); }
      else { out.push({from:i,to,capture:0}); if (r === startR && !b[idx(r+2*dir,c)]) out.push({from:i,to:idx(r+2*dir,c),capture:0,double:true}); }
    }
    for (const dc of [-1,1]) {
      if (!inB(r+dir,c+dc)) continue;
      const t = idx(r+dir,c+dc);
      if (b[t] && pColor(b[t]) === enemy) {
        if (r+dir === promoRank) { for (const pr of [PT.QUEEN,PT.ROOK,PT.BISHOP,PT.KNIGHT]) out.push({from:i,to:t,capture:b[t],promo:pr}); }
        else out.push({from:i,to:t,capture:b[t]});
      }
      if (ep !== null && ep === t && !b[t] && b[idx(r,c+dc)] && pType(b[idx(r,c+dc)])===PT.PAWN && pColor(b[idx(r,c+dc)])===enemy) out.push({from:i,to:t,capture:b[idx(r,c+dc)],ep:true});
    }
  } else if (type === PT.KNIGHT) {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) push(r+dr,c+dc);
  } else if (type === PT.BISHOP) { for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr,dc); }
  else if (type === PT.ROOK) { for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc); }
  else if (type === PT.QUEEN) { for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc); }
  else if (type === PT.KING) { for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) push(r+dr,c+dc); }
  return out;
}

function attacked(b, sq, byColor) {
  for (let i = 0; i < 64; i++) {
    if (!b[i] || pColor(b[i]) !== byColor) continue;
    for (const m of pseudoMoves(b, i, null, null)) if (m.to === sq) return true;
  }
  return false;
}
function kingSq(b, color) { for (let i = 0; i < 64; i++) if (b[i] === P(PT.KING, color)) return i; return -1; }
function isInCheck(st, color) { const k = kingSq(st.board, color); if (k < 0) return true; return attacked(st.board, k, 1 - color); }

function legalMovesFrom(st, i) {
  const b = st.board, color = pColor(b[i]), out = [];
  for (const m of pseudoMoves(b, i, st.ep, st.castling)) {
    const n = applyRaw(b, m);
    const opp = 1 - color;
    if (!attacked(n, kingSq(n, color), opp)) out.push(m);
  }
  if (pType(b[i]) === PT.KING) {
    const r = color === CL.WHITE ? 7 : 0;
    if (i === idx(r,4)) {
      const ks = color === CL.WHITE ? 'K' : 'k', qs = color === CL.WHITE ? 'Q' : 'q';
      const rookK = b[idx(r,7)] === P(PT.ROOK,color), rookQ = b[idx(r,0)] === P(PT.ROOK,color);
      if (st.castling[ks] && rookK && !b[idx(r,5)] && !b[idx(r,6)]) {
        const n1 = applyRaw(b, {from:i,to:idx(r,5)}), n2 = applyRaw(b, {from:i,to:idx(r,6)});
        if (!attacked(b, i, 1-color) && !attacked(n1, idx(r,5), 1-color) && !attacked(n2, idx(r,6), 1-color)) out.push({from:i,to:idx(r,6),capture:0,castle:'k'});
      }
      if (st.castling[qs] && rookQ && !b[idx(r,3)] && !b[idx(r,2)] && !b[idx(r,1)]) {
        const n1 = applyRaw(b, {from:i,to:idx(r,3)}), n2 = applyRaw(b, {from:i,to:idx(r,2)});
        if (!attacked(b, i, 1-color) && !attacked(n1, idx(r,3), 1-color) && !attacked(n2, idx(r,2), 1-color)) out.push({from:i,to:idx(r,2),capture:0,castle:'q'});
      }
    }
  }
  return out;
}
function applyRaw(b, m) { const n = b.slice(); n[m.to] = n[m.from]; n[m.from] = 0; if (m.ep) n[idx(row(m.from), col(m.to))] = 0; return n; }

function allLegal(st, color) {
  const out = [];
  for (let i = 0; i < 64; i++) if (st.board[i] && pColor(st.board[i]) === color) out.push(...legalMovesFrom(st, i));
  return out;
}

function doMove(st, m) {
  const n = cloneSt(st);
  const p = n.board[m.from];
  n.board[m.to] = p; n.board[m.from] = 0;
  if (m.ep) n.board[idx(row(m.from), col(m.to))] = 0;
  if (m.castle === 'k') { const r = row(m.from); n.board[idx(r,5)] = n.board[idx(r,7)]; n.board[idx(r,7)] = 0; }
  if (m.castle === 'q') { const r = row(m.from); n.board[idx(r,3)] = n.board[idx(r,0)]; n.board[idx(r,0)] = 0; }
  if (m.promo) n.board[m.to] = P(m.promo, pColor(p));
  n.ep = m.double ? idx((row(m.from)+row(m.to))/2, col(m.from)) : null;
  if (pType(p) === PT.KING) { if (pColor(p) === CL.WHITE) { n.castling.K = false; n.castling.Q = false; } else { n.castling.k = false; n.castling.q = false; } }
  if (m.from === idx(7,7) || m.to === idx(7,7)) n.castling.K = false;
  if (m.from === idx(7,0) || m.to === idx(7,0)) n.castling.Q = false;
  if (m.from === idx(0,7) || m.to === idx(0,7)) n.castling.k = false;
  if (m.from === idx(0,0) || m.to === idx(0,0)) n.castling.q = false;
  n.turn = 1 - st.turn;
  n.fullmove = st.turn === CL.BLACK ? st.fullmove + 1 : st.fullmove;
  n.halfmove = (pType(p) === PT.PAWN || m.capture) ? 0 : st.halfmove + 1;
  return n;
}

function inCheckmate(st, color) { return isInCheck(st, color) && allLegal(st, color).length === 0; }
function isStalemate(st, color) { return !isInCheck(st, color) && allLegal(st, color).length === 0; }

// ---------- SAN ----------
const SAN_LETTER = { 1:'K', 2:'Q', 3:'R', 4:'B', 5:'N', 6:'' };
function toSAN(st, m) {
  const p = st.board[m.from], pt = pType(p);
  let san;
  if (m.castle === 'k') san = 'O-O';
  else if (m.castle === 'q') san = 'O-O-O';
  else {
    const isCap = !!st.board[m.to] || m.ep;
    let dis = '';
    if (pt !== PT.PAWN && pt !== PT.KING) {
      const rivals = allLegal(st, pColor(p)).filter(x => x.to === m.to && x.from !== m.from && pType(st.board[x.from]) === pt);
      if (rivals.length) {
        const sameFile = rivals.some(x => col(x.from) === col(m.from));
        const sameRank = rivals.some(x => row(x.from) === row(m.from));
        if (!sameFile) dis = String.fromCharCode(97 + col(m.from));
        else if (!sameRank) dis = String(8 - row(m.from));
        else dis = sqName(m.from);
      }
    }
    let pre = (SAN_LETTER[pt] || '') + dis;
    if (pt === PT.PAWN && isCap) pre = String.fromCharCode(97 + col(m.from));
    san = pre + (isCap ? 'x' : '') + sqName(m.to);
    if (m.promo) san += '=' + (SAN_LETTER[m.promo] || 'Q');
  }
  const after = doMove(st, m);
  if (isInCheck(after, after.turn)) san += allLegal(after, after.turn).length ? '+' : '#';
  return san;
}

function parseSAN(st, san) {
  const raw = String(san).trim();
  let s = raw.replace(/[!?]+$/,'');
  const low = s.toLowerCase();
  const legal = allLegal(st, st.turn);
  if (low === 'o-o' || low === '0-0') { const m = legal.find(x => x.castle === 'k'); return m || null; }
  if (low === 'o-o-o' || low === '0-0-0') { const m = legal.find(x => x.castle === 'q'); return m || null; }
  s = s.replace(/[+#]/g, '');
  let promo = null;
  const pm = s.match(/=([QRBN])$/i); if (pm) { promo = ({Q:PT.QUEEN,R:PT.ROOK,B:PT.BISHOP,N:PT.KNIGHT})[pm[1].toUpperCase()]; s = s.slice(0, pm.index); }
  const cands = legal.filter(m => {
    if (promo && m.promo !== promo) return false;
    if (!promo && m.promo) return false;
    return true;
  });
  const score = m => {
    const pt = pType(st.board[m.from]);
    const L = SAN_LETTER[pt];
    return { pt, L };
  };
  const t = s.replace(/x/g, '');
  let matches = [];
  // long algebraic e2e4
  if (/^[a-h][1-8][a-h][1-8]$/.test(t)) {
    const from = nameSq(t.slice(0,2)), to = nameSq(t.slice(2));
    matches = cands.filter(m => m.from === from && m.to === to);
  } else if (/^[a-h][1-8]$/.test(t)) {
    const to = nameSq(t);
    matches = cands.filter(m => {
      const pt = pType(st.board[m.from]);
      if (![PT.PAWN, PT.KING].includes(pt)) return false;
      if (m.to !== to) return false;
      if (pt === PT.PAWN && col(m.from) !== col(m.to)) return false; // pawn push only when no piece letter
      return true;
    });
  } else {
    const mm = t.match(/^([KQRBN]?)([a-h]?)([1-8]?)([a-h][1-8])$/);
    if (!mm) return null;
    const [, L, ff, rr, dest] = mm;
    const to = nameSq(dest);
    const wantPT = L ? ({K:PT.KING,Q:PT.QUEEN,R:PT.ROOK,B:PT.BISHOP,N:PT.KNIGHT})[L] : PT.PAWN;
    matches = cands.filter(m => {
      if (m.to !== to) return false;
      const pt = pType(st.board[m.from]);
      if (pt !== wantPT) return false;
      if (!L && col(m.from) === col(m.to)) return false; // pawn push written without file
      if (ff && col(m.from) !== ff.charCodeAt(0) - 97) return false;
      if (rr && row(m.from) !== 8 - parseInt(rr, 10)) return false;
      return true;
    });
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // ambiguous capture notation a la "exd5" already filtered by file; pick pawn capture if unique
    const caps = matches.filter(m => st.board[m.to] || m.ep);
    if (caps.length === 1) return caps[0];
    return { ambiguous: matches };
  }
  return null;
}

// ---------- perft ----------
function perft(st, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of allLegal(st, st.turn)) {
    if (depth === 1) { n++; continue; }
    n += perft(doMove(st, m), depth - 1);
  }
  return n;
}

module.exports = { PT, CL, P, pType, pColor, row, col, idx, inB, sqName, nameSq, parseFEN, toFEN, cloneSt, pseudoMoves, allLegal, legalMovesFrom, doMove, isInCheck, inCheckmate, isStalemate, toSAN, parseSAN, perft, kingSq, attacked };
