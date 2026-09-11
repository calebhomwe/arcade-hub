const C = require('./lc-chess.js'); const D = require('./lc-data.json');
function tok(st,t){const m=C.parseSAN(st,t);return (m&&!m.ambiguous)?m:null;}
let st=C.parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
for (const t of D.TRAPS.find(x=>x.name==='Siberian Trap').moves.split(' ')) { const m=tok(st,t); if(!m) break; st=C.doMove(st,m); }
st=C.doMove(st, C.allLegal(st,st.turn).find(m=>C.toSAN(st,m)==='a3'));
const qh2=C.allLegal(st,st.turn).find(m=>C.toSAN(st,m).replace(/[+#]$/,'')==='Qh2');
const a=C.doMove(st,qh2);
console.log('after 10.a3 Qh2+ white legal replies: '+C.allLegal(a,a.turn).map(m=>C.toSAN(a,m)).join(', '));
console.log('is Qh2 mate? '+C.inCheckmate(a,a.turn));
