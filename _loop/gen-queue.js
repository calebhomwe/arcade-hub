const fs = require('fs');
const games = fs.readdirSync(__dirname + '/../games').filter(f => f.endsWith('.html') && f !== 'index.html').sort();
const THEMES = [
  'kit juice integration (win/lose/hit/click hooks)',
  'juice audit: respect gamesMuted, cap DOM, no layout jank',
  'audio layering: action whoosh, score blip, fail sting',
  'visual polish: palette/contrast/glow consistency vs hub',
  'micro-animations: press-scale buttons, score pop, card entrance',
  'UX: 44px hit targets, status clarity, restart flow',
  'difficulty/pacing curve: fair ramp, pressure without rage',
  'celebration + stats: distinct win/lose show, best-score persistence'
];
const chess = [
  'chess: harness run (ztest_harness.html) + console audit, fix findings',
  'chess: verify all 10 mods respect juice slider and gamesMuted',
  'chess: perf pass — overlay caps, rAF cost, sprite cache',
  'chess: content pass — more taunts/titles/funny subtitles'
];
const lines = [];
let id = 1;
for (const g of games) {
  if (g === 'chess.html') continue;
  for (let p = 0; p < 8; p++) {
    lines.push(JSON.stringify({ id: id++, game: g, pass: p + 1, theme: THEMES[p], status: 'pending' }));
  }
}
for (let p = 0; p < chess.length; p++) {
  lines.push(JSON.stringify({ id: id++, game: 'chess.html', pass: p + 1, theme: chess[p], status: 'pending' }));
}
fs.writeFileSync(__dirname + '/queue.jsonl', lines.join('\n') + '\n');
fs.writeFileSync(__dirname + '/budget.json', JSON.stringify({ max_cycles_per_day: 30, cycles_today: 0, done_total: 0 }, null, 2));
console.log('queue tasks: ' + lines.length);
