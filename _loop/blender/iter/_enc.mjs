import { decodePNG, encodePNG } from "./pnglib.mjs";
import fs from "node:fs";
const img = decodePNG(fs.readFileSync(process.argv[2]));
console.log("img", img.width, img.height, img.data.length, img.data.buffer.byteLength, img.data.byteOffset);
const u = new Uint8Array(256*256*4);
console.log("u", u.length, u.buffer.byteLength, u.byteOffset);
try { const p = encodePNG(256,256,u); console.log("encode256 ok", p.length); } catch(e) { console.log("encode256 ERR", e.message); }
try { const p = encodePNG(img.width,img.height,img.data); console.log("encode512 ok", p.length); } catch(e) { console.log("encode512 ERR", e.message); }
