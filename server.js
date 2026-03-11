const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  currentProject: 0,
  totalProjects: 0, // filled by projects.json
};

// ─── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.css':  'text/css',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? '/display.html' : req.url);

  // Handle range requests for video streaming
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.webm'].includes(ext)) {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Video not found: ' + req.url);
      return;
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': MIME[ext] || 'application/octet-stream',
      };
      res.writeHead(206, head);
      file.pipe(res);
      return;
    }
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': MIME[ext],
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + req.url);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client !== exclude && client.readyState === 1) {
      client.send(msg);
    }
  }
}

function broadcastAll(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);

  // Send current state to newly connected client
  ws.send(JSON.stringify({ type: 'state', ...state }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'register') {
        ws.role = msg.role;
        console.log(`Registered as: ${msg.role}`);
      }

      if (msg.type === 'navigate') {
        const { direction, total } = msg;
        state.totalProjects = total;
        if (direction === 'next') {
          state.currentProject = (state.currentProject + 1) % total;
        } else if (direction === 'prev') {
          state.currentProject = (state.currentProject - 1 + total) % total;
        } else if (direction === 'goto') {
          state.currentProject = Math.max(0, Math.min(msg.index, total - 1));
        }
        broadcastAll({ type: 'state', ...state });
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total: ${clients.size}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Display : http://localhost:${PORT}/display.html`);
  console.log(`   iPad    : http://localhost:${PORT}/ipad.html`);
  console.log(`   (replace localhost with your local IP for cross-device use)\n`);
});
