# Development Showcase

Two-screen setup: a display showing project videos and an iPad to control it. Synced via WebSockets.

## Setup

```bash
npm install
npm start
```

Then open:
- Display: `http://<your-ip>:3000/display.html`
- iPad: `http://<your-ip>:3000/ipad.html`

Both devices need to be on the same WiFi network.

## Private files (not in repo)

You'll receive these via AirDrop:
- `projects.json` — put in root folder
- `videos/` folder — put in root folder

## Install as PWA

- Display (Chrome): Menu → Add to home screen
- iPad (Safari): Share → Add to home screen
