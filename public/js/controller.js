let assignments = [];
let currentIndex = -1;
let currentMode = 'overview';
let ws = null;
let wsRetryTimer = null;
let autoplayActive = false;

async function loadProjects() {
  try {
    const r = await fetch('/projects.json');
    const data = await r.json();
    assignments = data.assignments || [];
  } catch (e) {
    assignments = [
      { name: 'Demo Assignment', year: '1st year', keywords: ['demo'], description: 'Demo beschrijving.', students: [] }
    ];
  }
  buildGrid();
  if (assignments.length > 0 && currentIndex === -1) {
    currentIndex = 0;
    updateDetailView();
  }
}

function buildGrid() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';

  assignments.forEach((a, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';

    const keywords = (a.keywords || []).join(' · ');
    card.innerHTML = `
      <div class="project-card-title">${a.name || ''}</div>
      <div class="project-card-keywords">${keywords}</div>
    `;

    card.addEventListener('click', () => selectProject(i, true));
    grid.appendChild(card);
  });

  updateActiveCard();
}

function updateActiveCard() {
  document.querySelectorAll('.project-card').forEach((card, i) => {
    card.classList.toggle('active', i === currentIndex);
  });
}

function updateDetailView() {
  if (currentIndex < 0 || currentIndex >= assignments.length) return;
  const a = assignments[currentIndex];

  document.getElementById('detail-title').textContent = a.name || '—';
  document.getElementById('detail-keywords').textContent = (a.keywords || []).join(' · ');
  document.getElementById('detail-description').textContent = a.description || '';
  document.getElementById('detail-year').textContent = a.year || '';
}

function selectProject(index, switchToDetail = false) {
  if (index < 0 || index >= assignments.length) return;
  currentIndex = index;

  updateActiveCard();
  updateDetailView();

  if (switchToDetail && currentMode !== 'detail') {
    setMode('detail');
  }

  if (ws && ws.readyState === 1) {
    const assignment = assignments[index];
    ws.send(JSON.stringify({
      type: 'navigate',
      direction: 'goto',
      assignmentIndex: index,
      assignment: {
        name: assignment.name,
        year: assignment.year,
        students: assignment.students || []
      }
    }));
  }
}

function setMode(mode) {
  currentMode = mode;
  document.body.classList.toggle('detail-mode', mode === 'detail');
  document.getElementById('mode-btn').textContent = mode === 'detail' ? 'Overzicht' : 'Detail';
}

function startAutoplay() {
  autoplayActive = true;
  document.getElementById('autoplay-btn').classList.add('active');
}

function stopAutoplay() {
  autoplayActive = false;
  document.getElementById('autoplay-btn').classList.remove('active');
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    updateStatus('disconnected', 'Error');
    return;
  }

  ws.addEventListener('open', () => {
    updateStatus('connected', 'Live');
    ws.send(JSON.stringify({ type: 'register', role: 'controller' }));
    clearTimeout(wsRetryTimer);
  });

  ws.addEventListener('message', (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'state' && msg.currentProject !== currentIndex) {
        currentIndex = msg.currentProject;
        updateActiveCard();
        updateDetailView();
      }
      if (msg.type === 'videoEnded') {
        console.log('Received videoEnded, autoplayActive:', autoplayActive);
        if (autoplayActive) {
          const next = currentIndex < assignments.length - 1 ? currentIndex + 1 : 0;
          selectProject(next);
        }
      }
    } catch (e) {}
  });

  ws.addEventListener('close', () => {
    updateStatus('disconnected', 'Offline');
    wsRetryTimer = setTimeout(connectWS, 3000);
  });

  ws.addEventListener('error', () => ws.close());
}

function updateStatus(state, label) {
  const indicator = document.getElementById('status-indicator');
  document.getElementById('status-label').textContent = label;
  indicator.className = 'status-indicator ' + state;
}

// Event listeners
document.getElementById('mode-btn').addEventListener('click', () => {
  setMode(currentMode === 'detail' ? 'overview' : 'detail');
});

document.getElementById('prev-btn').addEventListener('click', () => {
  stopAutoplay();
  const prev = currentIndex > 0 ? currentIndex - 1 : assignments.length - 1;
  selectProject(prev);
});

document.getElementById('next-btn').addEventListener('click', () => {
  stopAutoplay();
  const next = currentIndex < assignments.length - 1 ? currentIndex + 1 : 0;
  selectProject(next);
});

document.getElementById('autoplay-btn').addEventListener('click', () => {
  if (autoplayActive) {
    stopAutoplay();
  } else {
    startAutoplay();
  }
});

// Wake lock
if ('wakeLock' in navigator) {
  navigator.wakeLock.request('screen').catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  });
}

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-controller.js').catch(() => {});
}

// Initialize
loadProjects().then(() => connectWS());
