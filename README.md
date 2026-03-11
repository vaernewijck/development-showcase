# Development Showcase

Two-screen setup: a display showing project videos and an iPad to control it. Synced via WebSockets.

## Structure

```
├── public/          # Client files (html, js, icons)
├── data/            # Project data (not in repo)
├── videos/          # Video files (not in repo)
├── server.js        # Node.js server
├── start.command    # Double-click to start on Mac
└── package.json
```

## Setup

```bash
npm install
npm start
```

Or double-click `start.command` on Mac.

## Private files (via AirDrop)

- `data/projects.json` — project data
- `videos/` — video files

## URLs

- Setup: `http://localhost:3000/setup.html`
- Display: `http://<ip>:3000/display.html`
- iPad: `http://<ip>:3000/ipad.html`
