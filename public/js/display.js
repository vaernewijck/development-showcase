let currentAssignment = null;
let displayOffset = 0;
let currentVideo = null;
let activeLayer = 'a';
let ws = null;
let wsRetryTimer = null;

// DOM elements
const layerA = document.getElementById('layer-a');
const layerB = document.getElementById('layer-b');
const conn = document.getElementById('conn');
const progressFill = document.getElementById('progress-fill');
const meta = document.getElementById('project-meta');

// Get offset from URL (?offset=0, ?offset=1) or random
const params = new URLSearchParams(location.search);
if (params.has('offset')) {
  displayOffset = parseInt(params.get('offset')) || 0;
} else {
  displayOffset = Math.floor(Math.random() * 100);
}

// Master display controls autoplay timing
const isMaster = params.has('master');

async function loadInitialData() {
  try {
    const r = await fetch('/projects.json');
    const data = await r.json();
    if (data.assignments && data.assignments.length > 0) {
      const assignment = data.assignments[0];
      const students = assignment.students || [];
      const studentIndex = students.length > 0 && displayOffset < students.length
        ? displayOffset
        : -1;
      showAssignment(assignment, studentIndex);
    }
  } catch(e) {
    showAssignment({ name: 'Demo', year: '1st year', students: [{ name: 'Student A', video: '' }] }, 0);
  }
}

function showAssignment(assignment, studentIndex) {
  currentAssignment = assignment;
  const students = assignment.students || [];

  meta.classList.remove('visible');

  if (studentIndex === -1 || students.length === 0) {
    setTimeout(() => {
      document.getElementById('meta-student').textContent = '—';
      document.getElementById('meta-year').textContent = assignment.year || '';
      document.getElementById('counter').textContent = '';
      meta.classList.add('visible');
    }, 300);
    loadVideo('');
    return;
  }

  const student = students[studentIndex];

  setTimeout(() => {
    document.getElementById('meta-student').textContent = student.name || '—';
    document.getElementById('meta-year').textContent = assignment.year || '';
    document.getElementById('counter').textContent =
      String(studentIndex + 1).padStart(2,'0') + ' / ' + String(students.length).padStart(2,'0');
    meta.classList.add('visible');
  }, 300);

  loadVideo(student.video || '');
}

function updateProgress() {
  if (currentVideo && currentVideo.duration) {
    const pct = (currentVideo.currentTime / currentVideo.duration) * 100;
    progressFill.style.width = pct + '%';
  }
}

function loadVideo(src) {
  const currentLayer = activeLayer === 'a' ? layerA : layerB;
  const nextLayer = activeLayer === 'a' ? layerB : layerA;

  nextLayer.innerHTML = '';
  progressFill.style.width = '0%';

  if (src) {
    const video = document.createElement('video');
    video.src = src;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;

    video.addEventListener('ended', () => {
      console.log('Video ended, isMaster:', isMaster, 'ws ready:', ws?.readyState === 1);
      if (isMaster && ws && ws.readyState === 1) {
        console.log('Sending videoEnded to server');
        ws.send(JSON.stringify({ type: 'videoEnded' }));
      }
    });

    nextLayer.appendChild(video);
    video.play().catch(() => {});

    currentVideo = video;
    video.addEventListener('timeupdate', updateProgress);
  } else {
    const ph = document.createElement('div');
    ph.className = 'video-placeholder';
    ph.innerHTML = `<div class="placeholder-inner"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`;
    nextLayer.appendChild(ph);
    currentVideo = null;

    if (isMaster) {
      setTimeout(() => {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'videoEnded' }));
        }
      }, 5000);
    }
  }

  currentLayer.classList.remove('active');
  nextLayer.classList.add('active');
  activeLayer = activeLayer === 'a' ? 'b' : 'a';
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener('open', () => {
    conn.textContent = 'Verbonden';
    conn.className = 'connected';
    ws.send(JSON.stringify({ type: 'register', role: 'display', offset: displayOffset }));
    setTimeout(() => conn.classList.add('hidden'), 3000);
    clearTimeout(wsRetryTimer);
  });

  ws.addEventListener('message', (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'state' && msg.assignment) {
        const studentIndex = typeof msg.studentIndex === 'number' ? msg.studentIndex : -1;
        showAssignment(msg.assignment, studentIndex);
      }
    } catch(e) {}
  });

  ws.addEventListener('close', () => {
    conn.textContent = 'Verbinding verbroken';
    conn.className = 'disconnected';
    conn.classList.remove('hidden');
    wsRetryTimer = setTimeout(connectWS, 3000);
  });

  ws.addEventListener('error', () => ws.close());
}

// Wake lock
if ('wakeLock' in navigator) {
  async function requestWakeLock() {
    try { await navigator.wakeLock.request('screen'); } catch(e) {}
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
}

// Initialize
loadInitialData().then(() => connectWS());
