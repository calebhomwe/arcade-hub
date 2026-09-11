// minimal ws client (stdlib only) - enough for CDP
const net = require('net'), crypto = require('crypto'), { EventEmitter } = require('events');

class MiniWS extends EventEmitter {
  constructor(url) {
    super();
    const m = /^ws:\/\/([^:/]+):(\d+)(\/.*)$/.exec(url);
    if (!m) throw new Error('bad ws url ' + url);
    this.host = m[1]; this.port = +m[2]; this.path = m[3];
    this.buf = Buffer.alloc(0);
    this.frag = [];
    this.open = false;
  }
  connect() {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(this.port, this.host, () => {
      sock.write('GET ' + this.path + ' HTTP/1.1\r\n' +
        'Host: ' + this.host + ':' + this.port + '\r\n' +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    this.sock = sock;
    let handshake = false;
    sock.on('data', d => {
      this.buf = Buffer.concat([this.buf, d]);
      if (!handshake) {
        const i = this.buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        const head = this.buf.slice(0, i).toString();
        if (!/101/.test(head.split('\r\n')[0])) { this.emit('error', new Error('handshake failed: ' + head.split('\r\n')[0])); return; }
        this.buf = this.buf.slice(i + 4);
        handshake = true; this.open = true; this.emit('open');
      }
      this.parse();
    });
    sock.on('error', e => this.emit('error', e));
    sock.on('close', () => this.emit('close'));
  }
  parse() {
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      let mask = null;
      if (masked) { if (this.buf.length < off + 4) return; mask = this.buf.slice(off, off + 4); off += 4; }
      if (this.buf.length < off + len) return;
      let payload = this.buf.slice(off, off + len);
      if (mask) { const p = Buffer.alloc(len); for (let i = 0; i < len; i++) p[i] = payload[i] ^ mask[i & 3]; payload = p; }
      this.buf = this.buf.slice(off + len);
      if (op === 0x8) { this.emit('close'); continue; }
      if (op === 0x9) { this.sendFrame(payload, 0xa); continue; }
      if (op === 0xa) continue;
      this.frag.push(payload);
      if (fin) { const full = Buffer.concat(this.frag); this.frag = []; this.emit('message', full.toString('utf8')); }
    }
  }
  sendFrame(payload, op) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    const n = data.length;
    let head;
    if (n < 126) head = Buffer.from([0x80 | op, 0x80 | n]);
    else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(n, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(n), 2); }
    const masked = Buffer.alloc(n);
    for (let i = 0; i < n; i++) masked[i] = data[i] ^ mask[i & 3];
    this.sock.write(Buffer.concat([head, mask, masked]));
  }
  send(s) { this.sendFrame(s, 0x1); }
  close() { try { this.sendFrame(Buffer.alloc(0), 0x8); this.sock.end(); } catch (e) {} }
}
module.exports = MiniWS;
