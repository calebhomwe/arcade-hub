const fs = require('fs');
const dir = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub\\games\\audio\\memes';
const p = dir + '\\manifest.json';
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
for (const pack of m.packs) {
  if (pack.id === 'tts') { pack.on = false; pack.desc = (pack.desc || '') + ' (off by default - the game now speaks with the browser voice instead)'; }
}
fs.writeFileSync(p, JSON.stringify(m, null, 1));
console.log('tts pack off:', m.packs.map(x => x.id + '=' + x.on).join(' '));
