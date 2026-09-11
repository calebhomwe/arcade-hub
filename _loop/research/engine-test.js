const PT = { NONE:0, KING:1, QUEEN:2, ROOK:3, BISHOP:4, KNIGHT:5, PAWN:6 };
const CL = { WHITE:0, BLACK:1 };
const P = (piece, color) => (color << 3) | piece;
const pType = p => p & 7;
const pColor = p => (p >> 3) & 1;
const CH = {
  [P(PT.KING,0)]:'♔',[P(PT.QUEEN,0)]:'♕',[P(PT.ROOK,0)]:'♖',
  [P(PT.BISHOP,0)]:'♗',[P(PT.KNIGHT,0)]:'♘',[P(PT.PAWN,0)]:'♙',
  [P(PT.KING,1)]:'♚',[P(PT.QUEEN,1)]:'♛',[P(PT.ROOK,1)]:'♜',
  [P(PT.BISHOP,1)]:'♝',[P(PT.KNIGHT,1)]:'♞',[P(PT.PAWN,1)]:'♟',
};
const VAL = { [PT.PAWN]:1, [PT.KNIGHT]:3, [PT.BISHOP]:3, [PT.ROOK]:5, [PT.QUEEN]:9, [PT.KING]:0 };
function initBoard() {
  const b = new Array(64).fill(0);
  const back = [PT.ROOK, PT.KNIGHT, PT.BISHOP, PT.QUEEN, PT.KING, PT.BISHOP, PT.KNIGHT, PT.ROOK];
  for (let i = 0; i < 8; i++) {
    b[i] = P(back[i], CL.BLACK);
    b[8+i] = P(PT.PAWN, CL.BLACK);
    b[48+i] = P(PT.PAWN, CL.WHITE);
    b[56+i] = P(back[i], CL.WHITE);
  }
  return b;
}

function cloneB(b) { return b.slice(); }
function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function idx(r, c) { return r * 8 + c; }
function row(i) { return Math.floor(i / 8); }
function col(i) { return i % 8; }
function getPseudoMoves(b, i, epTarget) {
  const p = b[i]; if (!p) return [];
  const type = pType(p), color = pColor(p);
  const r = row(i), c = col(i);
  const moves = [];
  const enemy = 1 - color;
  const add = (tr, tc) => {
    if (inB(tr,tc)) { const t = idx(tr,tc); const tp = b[t];
      if (!tp || pColor(tp) === enemy) moves.push({from:i, to:t, capture:tp}); }
  };
  const slide = (dr, dc) => {
    for (let nr=r+dr, nc=c+dc; inB(nr,nc); nr+=dr, nc+=dc) {
      const t = idx(nr,nc);
      if (b[t]) { if (pColor(b[t])===enemy) moves.push({from:i, to:t, capture:b[t]}); break; }
      moves.push({from:i, to:t, capture:0});
    }
  };
  if (type === PT.PAWN) {
    const dir = color === CL.WHITE ? -1 : 1;
    const startR = color === CL.WHITE ? 6 : 1;
    const promoRank = color === CL.WHITE ? 0 : 7;
    const fwd = idx(r+dir, c);
    if (inB(r+dir, c) && !b[fwd]) {
      moves.push({from:i, to:fwd, capture:0, promo: (r+dir===promoRank)});
      if (r === startR) { const fwd2 = idx(r+2*dir, c); if (!b[fwd2]) moves.push({from:i, to:fwd2, capture:0}); }
    }
    for (const dc of [-1, 1]) {
      if (inB(r+dir, c+dc)) {
        const t = idx(r+dir, c+dc);
        if (b[t] && pColor(b[t]) === enemy) moves.push({from:i, to:t, capture:b[t], promo: (r+dir===promoRank)});
        if (epTarget !== null && epTarget === t && !b[t]) moves.push({from:i, to:t, capture:b[idx(r,c+dc)], ep:true});
      }
    }
  } else if (type === PT.KNIGHT) {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr, c+dc);
  } else if (type === PT.BISHOP) {
    for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
  } else if (type === PT.ROOK) {
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
  } else if (type === PT.QUEEN) {
    for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
  } else if (type === PT.KING) {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr, c+dc);
  }
  return moves;
}

function isInCheck(b, color) {
  const ki = b.findIndex(p => p === P(PT.KING, color));
  if (ki === -1) return true;
  const enemy = 1 - color;
  for (let i = 0; i < 64; i++) {
    if (b[i] && pColor(b[i]) === enemy) {
      if (getPseudoMoves(b, i, null).some(m => m.to === ki)) return true;
    }
  }
  return false;
}

function applyMove(b, m) { const nb = cloneB(b); nb[m.to] = nb[m.from]; nb[m.from] = 0; return nb; }

function getLegalMoves(b, i, epTarget, castlingRights) {
  const color = pColor(b[i]);
  const pseudo = getPseudoMoves(b, i, epTarget);
  const legal = [];
  for (const m of pseudo) {
    const nb = cloneB(b);
    nb[m.to] = nb[m.from]; nb[m.from] = 0;
    if (m.ep) { const cr = color === CL.WHITE ? row(m.to)+1 : row(m.to)-1; nb[idx(cr, col(m.to))] = 0; }
    if (!isInCheck(nb, color)) legal.push(m);
  }
  if (pType(b[i]) === PT.KING) {
    const r = color === CL.WHITE ? 7 : 0;
    if (i === idx(r,4) && !isInCheck(b, color)) {
      const ks = color === CL.WHITE ? 'K' : 'k';
      if (castlingRights[ks] && !b[idx(r,5)] && !b[idx(r,6)] &&
          !isInCheck(applyMove(b,{from:i,to:idx(r,5)}),color) &&
          !isInCheck(applyMove(b,{from:i,to:idx(r,6)}),color))
        legal.push({from:i, to:idx(r,6), capture:0, castle:'kingside'});
      const qs = color === CL.WHITE ? 'Q' : 'q';
      if (castlingRights[qs] && !b[idx(r,3)] && !b[idx(r,2)] && !b[idx(r,1)] &&
          !isInCheck(applyMove(b,{from:i,to:idx(r,3)}),color) &&
          !isInCheck(applyMove(b,{from:i,to:idx(r,2)}),color))
        legal.push({from:i, to:idx(r,2), capture:0, castle:'queenside'});
    }
  }
  return legal;
}

function getAllLegalMoves(b, color, epTarget, castlingRights) {
  const moves = [];
  for (let i = 0; i < 64; i++) if (b[i] && pColor(b[i]) === color) moves.push(...getLegalMoves(b, i, epTarget, castlingRights));
  return moves;
}

function makeMove(b, move, gameState) {
  const nb = cloneB(b);
  let captured = nb[move.to];
  nb[move.to] = nb[move.from]; nb[move.from] = 0;
  let newEp = null;
  let newCastling = {...gameState.castlingRights};
  if (move.castle) {
    const r = row(move.from);
    if (move.castle === 'kingside') { nb[idx(r,5)] = nb[idx(r,7)]; nb[idx(r,7)] = 0; }
    else { nb[idx(r,3)] = nb[idx(r,0)]; nb[idx(r,0)] = 0; }
  }
  if (move.ep) {
    const cr = pColor(nb[move.to]) === CL.WHITE ? row(move.to)+1 : row(move.to)-1;
    captured = b[idx(cr, col(move.to))]; nb[idx(cr, col(move.to))] = 0;
  }
  const mp = nb[move.to];
  if (pType(mp) === PT.PAWN && Math.abs(row(move.to)-row(move.from)) === 2)
    newEp = idx((row(move.to)+row(move.from))/2, col(move.to));
  if (pType(mp) === PT.KING) { if (pColor(mp)===CL.WHITE){newCastling.K=false;newCastling.Q=false;} else {newCastling.k=false;newCastling.q=false;} }
  if (pType(mp) === PT.ROOK) {
    if (move.from === idx(7,7)) newCastling.K = false; if (move.from === idx(7,0)) newCastling.Q = false;
    if (move.from === idx(0,7)) newCastling.k = false; if (move.from === idx(0,0)) newCastling.q = false;
  }
  if (move.to === idx(7,7)) newCastling.K = false; if (move.to === idx(7,0)) newCastling.Q = false;
  if (move.to === idx(0,7)) newCastling.k = false; if (move.to === idx(0,0)) newCastling.q = false;
  if (move.promo) nb[move.to] = P(move.promoPiece || PT.QUEEN, pColor(nb[move.to]));
  return { board: nb, ep: newEp, castling: newCastling, captured };
}

// ---- tests ----
const n = s => s;
function sq(s){ return (8-parseInt(s[1],10))*8 + (s.charCodeAt(0)-97); }
function name(i){ return String.fromCharCode(97+(i%8)) + (8-Math.floor(i/8)); }
let R = { K:true, Q:true, k:true, q:true };
let b = initBoard();
function movesFor(board, square, rights){ return getLegalMoves(board, square, null, rights).map(m => name(m.from)+name(m.to)+(m.castle?'('+m.castle+')':'')).join(' '); }

console.log('start king e1 moves:', movesFor(b, sq('e1'), R));
// Play e4, Nf3, Bc4 as white (with black replies that keep squares clear)
const seq = [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6']];
for (const [a,to] of seq) {
  const from = sq(a), dest = sq(to);
  const legal = getAllLegalMoves(b, pColor(b[from]), null, R);
  const m = legal.find(x => x.from===from && x.to===dest);
  if (!m) { console.log('ILLEGAL SETUP MOVE', a+to); process.exit(1); }
  const res = makeMove(b, m, { castlingRights: R });
  b = res.board; R = res.castling;
}
console.log('after setup, king e1 moves:', movesFor(b, sq('e1'), R));
console.log('e1=' + b[sq('e1')], 'f1=' + b[sq('f1')], 'g1=' + b[sq('g1')], 'h1=' + b[sq('h1')]);
// Now attempt the castle
const legal = getAllLegalMoves(b, CL.WHITE, null, R);
const cas = legal.find(m => m.castle);
console.log('castle offered:', JSON.stringify(cas), 'from=' + (cas?name(cas.from):'-'), 'to=' + (cas?name(cas.to):'-'));
if (cas) {
  const res = makeMove(b, cas, { castlingRights: R });
  const nb = res.board;
  console.log('after castle: g1=' + nb[sq('g1')] + ' (want ' + P(PT.KING,CL.WHITE) + ') f1=' + nb[sq('f1')] + ' (want ' + P(PT.ROOK,CL.WHITE) + ') h1=' + nb[sq('h1')] + ' (want 0)');
}
// castling rights expiry tests
let b2 = initBoard(); let R2 = {K:true,Q:true,k:true,q:true};
function play(board, rights, from, to){ const ms = getAllLegalMoves(board, pColor(board[from]), null, rights); const m = ms.find(x=>x.from===from&&x.to===to); if(!m) return null; return makeMove(board, m, {castlingRights:rights}); }
let r1 = play(b2, R2, sq('g1'), sq('f3')); let R3 = r1.castling; let b3 = r1.board;
let r2 = play(b3, R3, sq('f3'), sq('g1')); console.log('after Nf3 Ng1, king e1 moves:', movesFor(r2.board, sq('e1'), r2.castling));
let r3 = play(b2, R2, sq('h1'), sq('h2')); console.log('after Rh1-h2, king e1 moves:', movesFor(r3.board, sq('e1'), r3.castling));
let r4 = play(b2, R2, sq('e1'), sq('e2')); console.log('after Ke1-e2, king e2 moves:', movesFor(r4.board, sq('e2'), r4.castling));
