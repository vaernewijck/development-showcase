const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

let state = {
  currentProject: 0,
  assignment: null,
  assignmentVisitCount: {},  // tracks rotation per assignment
};

// Cache projects data for preloading calculations
let projectsData = null;
function loadProjectsData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'projects.json'), 'utf8');
    projectsData = JSON.parse(data);
  } catch (e) {
    console.error('Failed to load projects.json:', e.message);
    projectsData = { assignments: [] };
  }
}
loadProjectsData();

// Calculate next video URL for preloading
function getNextVideoUrl(currentAssignmentIndex, displayOffset) {
  if (!projectsData || !projectsData.assignments) return null;

  const nextIndex = (currentAssignmentIndex + 1) % projectsData.assignments.length;
  const nextAssignment = projectsData.assignments[nextIndex];
  if (!nextAssignment || !nextAssignment.students || nextAssignment.students.length === 0) return null;

  // Use visitCount for next assignment (it will be 0 if not visited yet)
  const visitCount = state.assignmentVisitCount[nextIndex] || 0;
  const studentIndex = (displayOffset + visitCount) % nextAssignment.students.length;
  const student = nextAssignment.students[studentIndex];

  return student && student.video ? student.video : null;
}

// Track displays with their offset and master status
const displays = new Map(); // ws -> { offset: number, isMaster: boolean }
let masterDisplay = null; // Track the single master display
let videoEndedCooldown = false;
const VIDEO_ENDED_COOLDOWN_MS = 2000;

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

const server = http.createServer((req, res) => {
  // Strip query string from URL
  const urlPath = req.url.split('?')[0];

  // API endpoint for local IP
  if (urlPath === '/api/ip') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: getLocalIP(), port: PORT }));
    return;
  }

  // Route to correct folder
  let filePath;
  const publicBase = path.join(__dirname, 'public');
  const dataBase = path.join(__dirname, 'data');

  if (urlPath === '/') {
    filePath = path.join(__dirname, 'public', 'display.html');
  } else if (urlPath === '/projects.json') {
    filePath = path.join(__dirname, 'data', 'projects.json');
  } else if (urlPath.startsWith('/videos/')) {
    filePath = path.join(__dirname, 'data', urlPath);
  } else {
    filePath = path.join(__dirname, 'public', urlPath);
  }

  // Prevent path traversal: resolved path must stay within its allowed base
  const resolvedPath = path.resolve(filePath);
  const allowedBase = (urlPath === '/projects.json' || urlPath.startsWith('/videos/')) ? dataBase : publicBase;
  if (!resolvedPath.startsWith(allowedBase + path.sep) && resolvedPath !== allowedBase) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  // Video streaming with range requests
  if (['.mp4', '.webm'].includes(ext)) {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Video not found');
      return;
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      file.on('error', (err) => { console.error('Stream error:', err); if (!res.headersSent) res.destroy(); });
      res.on('close', () => file.destroy());
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': MIME[ext],
      });
      file.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': MIME[ext],
      'Accept-Ranges': 'bytes',
    });
    const fullStream = fs.createReadStream(filePath);
    fullStream.on('error', (err) => { console.error('Stream error:', err); if (!res.headersSent) res.destroy(); });
    res.on('close', () => fullStream.destroy());
    fullStream.pipe(res);
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcastAll(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Send personalized state to each display
function sendToDisplays(assignment, assignmentIndex) {
  const students = assignment.students || [];
  const numStudents = students.length;
  const visitCount = state.assignmentVisitCount[assignmentIndex] || 0;
  const numDisplays = displays.size;

  for (const [ws, displayInfo] of displays) {
    if (ws.readyState !== 1) continue;

    let studentIndex;
    let isDuplicate = false;

    if (numStudents === 0) {
      studentIndex = -1; // no students, show placeholder
    } else {
      // Calculate which student this display should show
      // All displays get a valid student (wrapping around if needed)
      studentIndex = (displayInfo.offset + visitCount) % numStudents;

      // Mark as duplicate if more displays than students
      // (this display is showing the same video as another)
      if (numDisplays > numStudents && displayInfo.offset >= numStudents) {
        isDuplicate = true;
      }
    }

    // Calculate next video for preloading
    const nextVideoUrl = getNextVideoUrl(assignmentIndex, displayInfo.offset);

    ws.send(JSON.stringify({
      type: 'state',
      currentProject: assignmentIndex,
      studentIndex: studentIndex,
      assignment: assignment,
      isDuplicate: isDuplicate,
      nextVideoUrl: nextVideoUrl
    }));
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'register') {
        ws.role = msg.role;
        console.log(`Registered as: ${msg.role}`);

        // Track displays with their offset and master status
        if (msg.role === 'display' && typeof msg.offset === 'number') {
          const isMaster = msg.isMaster || false;
          displays.set(ws, { offset: msg.offset, isMaster: isMaster });

          // Track the master display (first one wins)
          if (isMaster && !masterDisplay) {
            masterDisplay = ws;
            console.log(`Master display registered with offset: ${msg.offset}`);
          } else {
            console.log(`Display registered with offset: ${msg.offset}`);
          }

          // Send current state to this display
          if (state.assignment) {
            const students = state.assignment.students || [];
            const numStudents = students.length;
            const visitCount = state.assignmentVisitCount[state.currentProject] || 0;
            const numDisplays = displays.size;

            let studentIndex;
            let isDuplicate = false;

            if (numStudents === 0) {
              studentIndex = -1;
            } else {
              studentIndex = (msg.offset + visitCount) % numStudents;
              if (numDisplays > numStudents && msg.offset >= numStudents) {
                isDuplicate = true;
              }
            }

            // Calculate next video for preloading
            const nextVideoUrl = getNextVideoUrl(state.currentProject, msg.offset);

            ws.send(JSON.stringify({
              type: 'state',
              currentProject: state.currentProject,
              studentIndex: studentIndex,
              assignment: state.assignment,
              isDuplicate: isDuplicate,
              nextVideoUrl: nextVideoUrl
            }));
          }
        }
      }

      if (msg.type === 'navigate' && msg.direction === 'goto') {
        const assignmentIndex = Number.isInteger(msg.assignmentIndex) && msg.assignmentIndex >= 0
          ? msg.assignmentIndex
          : 0;
        const assignment = msg.assignment || null;

        state.currentProject = assignmentIndex;
        state.assignment = assignment;

        // Send personalized state to each display
        if (assignment) {
          sendToDisplays(assignment, assignmentIndex);

          // Increment visit count for this assignment AFTER sending
          state.assignmentVisitCount[assignmentIndex] =
            (state.assignmentVisitCount[assignmentIndex] || 0) + 1;
        }

        // Notify controllers of current project (for sync)
        for (const client of clients) {
          if (client.role === 'controller' && client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'state',
              currentProject: assignmentIndex
            }));
          }
        }
      }

      // Forward videoEnded from master display to controllers (with debouncing)
      if (msg.type === 'videoEnded') {
        // Only accept from the registered master display
        if (ws !== masterDisplay) {
          console.log('Ignoring videoEnded from non-master display');
          return;
        }

        // Debounce to prevent rapid-fire advances
        if (videoEndedCooldown) {
          console.log('Ignoring videoEnded (cooldown active)');
          return;
        }

        videoEndedCooldown = true;
        setTimeout(() => { videoEndedCooldown = false; }, VIDEO_ENDED_COOLDOWN_MS);

        console.log('Received videoEnded from master display');
        let controllerCount = 0;
        for (const client of clients) {
          if (client.role === 'controller' && client.readyState === 1) {
            client.send(JSON.stringify({ type: 'videoEnded' }));
            controllerCount++;
          }
        }
        console.log(`Forwarded videoEnded to ${controllerCount} controller(s)`);
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    displays.delete(ws);

    // Clear master if it disconnected
    if (ws === masterDisplay) {
      masterDisplay = null;
      console.log('Master display disconnected');

      // Promote another master if available
      for (const [displayWs, info] of displays) {
        if (info.isMaster && displayWs.readyState === 1) {
          masterDisplay = displayWs;
          console.log('Promoted new master display');
          break;
        }
      }
    }

    console.log(`Client disconnected. Total: ${clients.size}`);
  });
});

server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`Server running at http://${ip}:${PORT}`);
  console.log(`Setup: http://localhost:${PORT}/setup.html`);
});
