let currentAssignment = null;
let currentStudentIndex = -1;
let numStudents = 0;
let displayOffset = 0;
let currentVideo = null;
let activeLayer = 'a';
let ws = null;
let wsRetryTimer = null;
let videoFailureTimer = null;
const VIDEO_FAILURE_TIMEOUT_MS = 15000; // Fallback if video fails to load/play

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
  displayOffset = 0;
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

function showAssignment(assignment, studentIndex, isDuplicate = false) {
  currentAssignment = assignment;
  const students = assignment.students || [];
  currentStudentIndex = studentIndex;
  numStudents = students.length;

  meta.classList.remove('visible');

  if (studentIndex === -1 || students.length === 0) {
    setTimeout(() => {
      document.getElementById('meta-student').textContent = '—';
      document.getElementById('meta-year').textContent = assignment.year || '';
      document.getElementById('counter').textContent = '';
      meta.classList.add('visible');
    }, 300);
    loadMedia('', false);
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

  loadMedia(student.video || '', isDuplicate);
}

function updateProgress() {
  if (currentVideo && currentVideo.duration) {
    const pct = (currentVideo.currentTime / currentVideo.duration) * 100;
    progressFill.style.width = pct + '%';
  }
}

function isImageFile(src) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(src);
}

function loadMedia(src, isDuplicate = false) {
  const currentLayer = activeLayer === 'a' ? layerA : layerB;
  const nextLayer = activeLayer === 'a' ? layerB : layerA;

  // Clear any pending failure timer
  clearTimeout(videoFailureTimer);

  nextLayer.innerHTML = '';
  progressFill.style.width = '0%';

  if (src && isImageFile(src)) {
    // Handle image
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    nextLayer.appendChild(img);
    currentVideo = null;

    // Master advances after 10 seconds for images
    if (isMaster) {
      setTimeout(() => {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'videoEnded' }));
        }
      }, 10000);
    }

    currentLayer.classList.remove('active');
    nextLayer.classList.add('active');
    activeLayer = activeLayer === 'a' ? 'b' : 'a';
    return;
  }

  if (src) {
    const video = document.createElement('video');
    video.src = src;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;

    let hasEnded = false;

    const handleVideoEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      clearTimeout(videoFailureTimer);

      console.log('Video ended, isMaster:', isMaster, 'ws ready:', ws?.readyState === 1);
      if (isMaster && ws && ws.readyState === 1) {
        console.log('Sending videoEnded to server');
        ws.send(JSON.stringify({ type: 'videoEnded' }));
      } else if (!isMaster) {
        // Non-master: loop the video
        video.currentTime = 0;
        video.play().catch(() => {});
        hasEnded = false; // Allow end to trigger again
      }
    };

    video.addEventListener('ended', handleVideoEnd);

    // Error handling: if video fails, trigger end after timeout
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      videoFailureTimer = setTimeout(handleVideoEnd, 3000);
    });

    video.addEventListener('stalled', () => {
      console.warn('Video stalled');
      videoFailureTimer = setTimeout(handleVideoEnd, VIDEO_FAILURE_TIMEOUT_MS);
    });

    // Fallback timeout in case video never plays or ends
    videoFailureTimer = setTimeout(() => {
      if (!hasEnded) {
        console.warn('Video timeout, triggering end');
        handleVideoEnd();
      }
    }, VIDEO_FAILURE_TIMEOUT_MS);

    // Clear timeout once video is playing successfully
    video.addEventListener('playing', () => {
      clearTimeout(videoFailureTimer);
    });

    nextLayer.appendChild(video);

    // For duplicate videos (more displays than videos), start at random position
    if (isDuplicate) {
      video.addEventListener('loadedmetadata', () => {
        const randomOffset = Math.random() * video.duration * 0.8; // Start within first 80%
        video.currentTime = randomOffset;
        console.log('Duplicate video starting at:', randomOffset.toFixed(1), 's');
      }, { once: true });
    }

    video.play().catch((err) => {
      console.error('Play failed:', err);
      videoFailureTimer = setTimeout(handleVideoEnd, 3000);
    });

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
    ws.send(JSON.stringify({ type: 'register', role: 'display', offset: displayOffset, isMaster: isMaster }));
    setTimeout(() => conn.classList.add('hidden'), 3000);
    clearTimeout(wsRetryTimer);
  });

  ws.addEventListener('message', (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'state' && msg.assignment) {
        const studentIndex = typeof msg.studentIndex === 'number' ? msg.studentIndex : -1;
        const isDuplicate = msg.isDuplicate || false;
        showAssignment(msg.assignment, studentIndex, isDuplicate);
      }
    } catch(e) {
      console.error('WebSocket message error:', e);
    }
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
