# PWA Display + iPad Controller

Een two-screen PWA systeem: een display-scherm en een iPad controller die real-time gesynchroniseerd zijn via WebSockets.

## Structuur

```
pwa-project/
├── server.js              ← Node.js server (WebSocket + statische bestanden)
├── display.html           ← Display scherm (volledig scherm video + info)
├── ipad.html              ← iPad controller (projectnavigatie)
├── projects.json          ← Projectdata (aanpassen naar je eigen projecten)
├── sw.js                  ← Service Worker (PWA offline support)
├── manifest-display.json  ← PWA manifest voor display
├── manifest-ipad.json     ← PWA manifest voor iPad
├── videos/                ← Map voor video's (zelf aanmaken)
│   ├── project-0.mp4
│   ├── project-1.mp4
│   └── ...
└── package.json
```

## Installatie & starten

```bash
npm install
npm start
```

Server draait op **http://localhost:3000**

## Gebruik

### Op het netwerk (cross-device)
Vervang `localhost` door het **lokale IP-adres** van de server:
- Display: `http://192.168.x.x:3000/display.html`
- iPad:    `http://192.168.x.x:3000/ipad.html`

> Zorg dat beide apparaten op hetzelfde WiFi-netwerk zitten.

### Als PWA installeren
- **Display**: Open in Chrome → Menu → *Toevoegen aan beginscherm* → kies "Volledig scherm"
- **iPad**: Open in Safari → Deel → *Zet op beginscherm*

## Video's toevoegen

1. Maak een map `videos/` aan in de projectmap
2. Voeg MP4-video's toe: `project-0.mp4`, `project-1.mp4`, etc.
3. Zorg voor **H.264 + AAC** codec voor maximale compatibiliteit
4. Pas het `video`-veld aan in `projects.json`

### Aanbevolen video-specs
| Instelling     | Waarde                          |
|----------------|----------------------------------|
| Codec          | H.264 (High Profile)            |
| Resolutie      | 1920×1080 of 3840×2160 (4K)     |
| Framerate      | 25 of 30 fps                    |
| Bitrate        | 8–20 Mbps (FHD), 40–80 Mbps (4K)|
| Audio          | Muted (of AAC)                   |
| Container      | .mp4                             |

## projects.json aanpassen

```json
[
  {
    "id": 0,
    "title": "Projectnaam",
    "subtitle": "Subtitel",
    "year": "2024",
    "location": "Amsterdam, NL",
    "category": "Architecture",
    "description": "Beschrijving van het project.",
    "details": {
      "Oppervlak": "5.000 m²",
      "Status": "Voltooid"
    },
    "video": "videos/project-0.mp4",
    "color": "#C8A96E"
  }
]
```

### Accentkleur per project
De `color` waarde bepaalt de accentkleur van zowel de display als de iPad per project.

## Features

### Display
- ✅ Fullscreen looping video met A/B crossfade
- ✅ Cinematische overlay met projectnaam, categorie, locatie & jaar
- ✅ Progressbalk onderaan
- ✅ Dynamische accentkleur per project
- ✅ Wake Lock (scherm blijft aan)
- ✅ Graceful fallback bij geen video (kleur gradient)
- ✅ Automatisch herverbinden bij verbindingsverlies

### iPad
- ✅ Swipe links/rechts of Vorige/Volgende knoppen
- ✅ Dot-navigatie (direct naar project springen)
- ✅ Toetsenbord ondersteuning (←→ pijltjes)
- ✅ Projectinfo: beschrijving, locatie, details grid
- ✅ Live verbindingsindicator
- ✅ Wake Lock (scherm blijft aan)
- ✅ Safe area ondersteuning (iPhone notch etc.)

## HTTPS voor productie

Voor HTTPS (vereist voor PWA-installatie op sommige apparaten):

```bash
# Met Caddy (eenvoudigste aanpak)
caddy reverse-proxy --from display.mijnstudio.nl --to localhost:3000

# Of gebruik een tunnel zoals ngrok voor testen:
ngrok http 3000
```
