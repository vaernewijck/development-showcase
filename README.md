# Development Showcase

Multi-display video showcase with controller. Each display shows a different student video, synced via WebSockets.

## Features

- **Multi-display sync**: Up to 3 displays, each showing different students
- **Smart rotation**: Same assignment shows different students each time
- **Autoplay**: Master display triggers next assignment when video ends
- **Controller**: Select assignments, navigate, toggle autoplay

## Structure

```
├── public/
│   ├── assets/          # Logo, icons
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript
│   ├── controller.html  # Controller interface
│   ├── display.html     # Video display
│   └── setup.html       # QR codes for setup
├── data/                # Not in repo
│   ├── projects.json    # Assignment data
│   └── videos/          # Video files by assignment
├── server.js            # Node.js WebSocket server
├── start.command        # Double-click to start (Mac)
└── package.json
```

## Setup

```bash
npm install
npm start
```

Or double-click `start.command` on Mac.

## URLs

- **Setup**: `http://localhost:3000/setup.html`
- **Controller**: `http://<ip>:3000/controller.html`
- **Display 1** (master): `http://<ip>:3000/display.html?offset=0&master=true`
- **Display 2**: `http://<ip>:3000/display.html?offset=1`
- **Display 3**: `http://<ip>:3000/display.html?offset=2`

## Data Structure

`data/projects.json`:
```json
{
  "assignments": [
    {
      "name": "Project Name",
      "year": "2nd year",
      "keywords": ["keyword1", "keyword2"],
      "description": "Project description",
      "students": [
        { "name": "Student Name", "video": "videos/folder/video.mp4" }
      ]
    }
  ]
}
```

## Private Files (not in repo)

Transfer via AirDrop or USB:
- `data/projects.json`
- `data/videos/{assignment}/` folders with video files
