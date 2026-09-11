const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub\\games\\audio\\memes';
function readJson(f) { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
const bank = readJson('manifest.json');
const caps = readJson('captions.json');
const out = '/* generated from manifest.json + captions.json - do not hand edit */\n' +
  'window.__MEME_BANK = ' + JSON.stringify(bank) + ';\n' +
  'window.__MEME_CAPTIONS = ' + JSON.stringify(caps) + ';\n';
const dest = path.join(ROOT, 'catalog.js');
fs.writeFileSync(dest, out);
console.log('wrote', dest, out.length, 'bytes; packs=' + bank.packs.length + ' sounds=' + bank.packs.reduce((n, p) => n + p.sounds.length, 0));
