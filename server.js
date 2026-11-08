// Harbor Heat multiplayer server. No installs needed: just run `node server.js`.
// It serves the game page AND relays player positions, chat, shots, hits and
// wanted levels between everyone in the same room (WebSocket, built by hand).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const PORT = +process.env.PORT || 8080;
const MAX_ROOM = 16;          // players per room
const MAX_PAYLOAD = 8192;     // bytes per message
const GAME = path.join(__dirname, 'harbor-heat-3d.html');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map();      // room name -> Map(id -> player)

const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/' || u === '/index.html' || u === '/harbor-heat-3d.html') {
    fs.readFile(GAME, (e, b) => {
      if (e) { res.writeHead(500); return res.end('harbor-heat-3d.html must be in the same folder as server.js'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(b);
    });
  } else if (u === '/health') {
    let n = 0; for (const r of rooms.values()) n += r.size;
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok, ' + n + ' players online');
  } else { res.writeHead(404); res.end('Not found'); }
});

// ---- WebSocket framing (RFC 6455) ----
function frame(op, p) {
  const n = p.length; let h;
  if (n < 126) h = Buffer.from([128 | op, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 128 | op; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, p]);
}
function parse(b) {
  if (b.length < 2) return null;
  const fin = !!(b[0] & 128), op = b[0] & 15, masked = !!(b[1] & 128);
  let len = b[1] & 127, o = 2;
  if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); o = 4; }
  else if (len === 127) { if (b.length < 10) return null; const big = b.readBigUInt64BE(2); if (big > BigInt(MAX_PAYLOAD)) return { bad: 1 }; len = Number(big); o = 10; }
  if (len > MAX_PAYLOAD || !masked) return { bad: 1 };   // browsers always mask
  if (b.length < o + 4 + len) return null;
  const m = b.subarray(o, o + 4), d = Buffer.from(b.subarray(o + 4, o + 4 + len));
  for (let i = 0; i < len; i++) d[i] ^= m[i & 3];
  return { fin, op, data: d, used: o + 4 + len };
}
const send = (s, o) => { if (!s.destroyed && s.writable) s.write(frame(1, Buffer.from(JSON.stringify(o)))); };
const bc = (room, o, except) => {
  const f = frame(1, Buffer.from(JSON.stringify(o)));
  for (const [i, q] of room) if (i !== except && !q.sock.destroyed) q.sock.write(f);
};
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const clean = d => { const o = {}; for (const k of Object.keys(d)) if (!BAD.has(k)) o[k] = d[k]; return o; };

function onMsg(room, id, me, txt) {
  const now = Date.now();
  if (now - me.t > 1000) { me.t = now; me.n = 0; }
  if (++me.n > 120) return;                       // flood protection
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'p' && m.d && typeof m.d === 'object' && !Array.isArray(m.d)) {      // presence (position etc.)
    const d = clean(m.d); if (JSON.stringify(d).length > 2048) return;
    Object.assign(me.p, d); if (JSON.stringify(me.p).length > 4096) me.p = d;
    bc(room, { t: 'p', id, d }, id);
  } else if (m.t === 'e' && typeof m.k === 'string' && /^[a-z]{1,12}$/.test(m.k)) { // events: chat, shot, hit, wanted
    if (JSON.stringify(m.d === undefined ? null : m.d).length > 1024) return;
    bc(room, { t: 'e', id, k: m.k, d: m.d });      // sent to everyone, including the sender
  }
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const u = new URL(req.url, 'http://x');
  const name = (u.searchParams.get('room') || 'lobby').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'lobby';
  let room = rooms.get(name); if (!room) rooms.set(name, room = new Map());
  if (room.size >= MAX_ROOM) { sock.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); sock.destroy(); return; }
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  sock.setNoDelay(true);
  const id = crypto.randomBytes(4).toString('hex'), me = { sock, p: {}, seen: Date.now(), n: 0, t: 0 };
  send(sock, { t: 'hello', id, peers: [...room].map(([i, q]) => ({ id: i, p: q.p })) });
  room.set(id, me); bc(room, { t: 'join', id, p: {} }, id);
  console.log(`[${name}] + ${id} (${room.size} online)`);
  let buf = Buffer.alloc(0), frag = null;
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (buf.length > MAX_PAYLOAD * 2 + 16) { sock.destroy(); return; }
    for (;;) {
      const f = parse(buf); if (!f) break;
      if (f.bad) { sock.destroy(); return; }
      buf = buf.subarray(f.used);
      if (f.op === 8) { try { sock.end(frame(8, Buffer.alloc(0))); } catch (e) {} return; }
      if (f.op === 9) { sock.write(frame(10, f.data)); continue; }
      if (f.op === 10) { me.seen = Date.now(); continue; }
      if (f.op === 1 || f.op === 0) {
        if (f.op === 1) frag = [];
        if (frag === null) continue;
        frag.push(f.data); if (!f.fin) continue;
        const txt = Buffer.concat(frag).toString('utf8'); frag = null; me.seen = Date.now();
        onMsg(room, id, me, txt);
      }
    }
  });
  const gone = () => {
    if (room.delete(id)) {
      bc(room, { t: 'leave', id }); console.log(`[${name}] - ${id} (${room.size} online)`);
      if (!room.size && rooms.get(name) === room) rooms.delete(name);
    }
  };
  sock.on('close', gone); sock.on('error', () => sock.destroy());
});

setInterval(() => {   // drop dead connections
  const now = Date.now();
  for (const room of rooms.values()) for (const q of room.values()) {
    if (now - q.seen > 60000) { q.sock.destroy(); continue; }
    if (!q.sock.destroyed) q.sock.write(frame(9, Buffer.alloc(0)));
  }
}, 25000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('Harbor Heat server is running.\n');
  console.log('  On this computer:  http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log('  Friends on your Wi-Fi: http://' + a.address + ':' + PORT);
  console.log('\nOpen that address in the browser, tap PLAY ONLINE, and share the room code.');
});
