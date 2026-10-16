import http from 'node:http';
import WebSocket from 'ws';
import { bounds, normalize } from './normalize.mjs';
const origin = process.env.ALLOWED_ORIGIN || 'https://jeffflaherty-droid.github.io';
const key = process.env.AISSTREAM_API_KEY;
const clients = new Set();
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.headers.origin !== origin) { res.writeHead(403).end(); return; }
  const headers = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  if (url.pathname !== '/events') { res.writeHead(404, headers).end(); return; }
  const box = bounds(url.searchParams.get('bbox'));
  if (!box) { res.writeHead(400, headers).end('Zoom in to view traffic'); return; }
  if (!key) { res.writeHead(503, headers).end('AIS feed not configured'); return; }
  if (clients.size >= 2) { res.writeHead(429, headers).end('AIS connection limit reached'); return; }
  res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  clients.add(res);
  const vessels = new Map();
  let socket, retry, closed = false, attempts = 0, lastData = 0;
  const send = (event, data) => { if (!res.destroyed && !res.writableEnded) { if (res.writableLength > 262144) { res.destroy(); return; } res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } };
  function connect() {
    if (closed) return;
    socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true });
    socket.on('open', () => {
      socket.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[box[0], box[1]], [box[2], box[3]]]], FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'] }));
      send('status', { message: 'Connected to relay · waiting for AIS reports' });
    });
    socket.on('message', raw => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.error || data.Error) { send('status', { message: 'AIS provider rejected the connection' }); socket.close(); return; }
        const v = normalize(data);
        if (v && v.lat >= box[0] && v.lat <= box[2] && v.lon >= box[1] && v.lon <= box[3]) { vessels.set(v.mmsi, v); lastData = Date.now(); attempts = 0; }
      } catch {}
    });
    socket.on('error', () => socket.close());
    socket.on('close', () => {
      vessels.clear(); lastData = 0;
      send('vessels', { vessels: [] });
      send('status', { message: 'AIS provider disconnected · reconnecting' });
      if (!closed) retry = setTimeout(connect, Math.min(60000, 2000 * 2 ** Math.min(attempts++, 5)) + Math.random() * 1000);
    });
  }
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [id, v] of vessels) if (now - v.updatedAt > 600000) vessels.delete(id);
    send('vessels', { vessels: [...vessels.values()] });
    if (!lastData || now - lastData > 60000) send('status', { message: 'No recent AIS reports · coverage may be unavailable' });
  }, 5000);
  res.on('close', () => { closed = true; clients.delete(res); clearInterval(interval); clearTimeout(retry); socket?.close(); });
  connect();
}).listen(Number(process.env.PORT || 8080));
