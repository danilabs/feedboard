# Feedboard

A browser-based video production toolkit that leverages MediaMTX as the media backbone. Create multiview layouts, capture local sources, and stream to MediaMTX - all from the browser.

**Design Philosophy:** Match MediaMTX's simplicity. Single JS file + HTML. Zero friction.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Open `http://localhost:5173` to use the full app, or include components in your own HTML.

## Usage

### Full Application

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="feedboard.js"></script>
</head>
<body>
  <feedboard-app server="http://localhost:8889"></feedboard-app>
</body>
</html>
```

### Individual Components

```html
<script type="module" src="feedboard.js"></script>

<!-- Video player (WHEP/HLS auto-detect) -->
<feedboard-player src="/camera1" server="http://localhost:8889"></feedboard-player>

<!-- Grid layout -->
<feedboard-grid layout="2x2" server="http://localhost:8889">
  <feedboard-player src="/cam1"></feedboard-player>
  <feedboard-player src="/cam2"></feedboard-player>
  <feedboard-clock format="HH:mm:ss"></feedboard-clock>
  <feedboard-slate text="STANDBY"></feedboard-slate>
</feedboard-grid>

<!-- Local capture (camera/screen/tab) with optional WHIP publish -->
<feedboard-capture type="camera" publish-to="/webcam"></feedboard-capture>

<!-- Clock -->
<feedboard-clock format="HH:mm:ss" timezone="America/New_York"></feedboard-clock>

<!-- Slate -->
<feedboard-slate text="NO SIGNAL" background="#1a1a1a"></feedboard-slate>
```

## Components

| Component | Description |
|-----------|-------------|
| `<feedboard-app>` | Full application with sidebar, grid, and controls |
| `<feedboard-player>` | Video player supporting WHEP and HLS |
| `<feedboard-grid>` | NxN grid layout (1x1, 2x2, 3x3, 4x4) |
| `<feedboard-capture>` | Local capture source (camera/screen/tab) with optional WHIP publishing |
| `<feedboard-clock>` | Clock/timecode display |
| `<feedboard-slate>` | Text/color slate |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-9` | Select cell |
| `0` | Deselect |
| `l` | Toggle labels |
| `u` | Toggle VU meters |
| `i` | Toggle info overlay |
| `g` | Cycle grid layout |
| `f` | Toggle fullscreen |
| `Enter` | Fullscreen selected cell |
| `Escape` | Exit fullscreen/info |
| `Delete` | Clear selected cell |
| Arrow keys | Navigate cells |

## Component Attributes

### `<feedboard-player>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | required | Stream path or full URL |
| `server` | string | - | MediaMTX server URL |
| `protocol` | `auto\|whep\|hls` | `auto` | Force protocol |
| `label` | string | - | Custom label (defaults to path) |
| `show-info` | boolean | `false` | Show info overlay |
| `show-label` | boolean | `false` | Show centered label |
| `show-vu` | boolean | `false` | Show VU meter (WHEP only) |

### `<feedboard-capture>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `camera\|screen\|tab` | `camera` | Capture source |
| `publish-to` | string | - | WHIP path (optional) |
| `server` | string | - | MediaMTX server URL |
| `device-id` | string | - | Specific camera device |
| `resolution` | `720p\|1080p\|4k` | `1080p` | Video resolution |
| `show-info` | boolean | `false` | Show controls overlay |
| `show-label` | boolean | `false` | Show centered label |
| `show-vu` | boolean | `false` | Show VU meter |

### `<feedboard-clock>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `HH:mm:ss` | Time format |
| `timezone` | string | local | IANA timezone |
| `label` | string | - | Display label |

### `<feedboard-slate>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | - | Display text |
| `background` | string | `#000` | Background color |
| `color` | string | `#fff` | Text color |

## MediaMTX Setup

Feedboard works with [MediaMTX](https://github.com/bluenviron/mediamtx). Default ports:

| Port | Protocol |
|------|----------|
| 8889 | WebRTC (WHEP/WHIP) |
| 8888 | HLS |
| 9997 | API |
| 8554 | RTSP |

```yaml
# mediamtx.yml - enable WebRTC
webrtc: yes
webrtcAddress: :8889
```

## Project Structure

```
feedboard/
├── src/
│   ├── index.ts              # Exports all elements
│   ├── elements/
│   │   ├── feedboard-app.ts
│   │   ├── feedboard-player.ts
│   │   ├── feedboard-grid.ts
│   │   ├── feedboard-capture.ts
│   │   ├── feedboard-clock.ts
│   │   └── feedboard-slate.ts
│   ├── lib/
│   │   ├── mediamtx-api.ts   # MediaMTX REST client
│   │   ├── whep-client.ts    # WHEP player
│   │   ├── whip-client.ts    # WHIP publisher
│   │   └── hls-player.ts     # HLS.js wrapper
│   └── types/
│       └── mediamtx.ts
├── public/
│   ├── index.html
│   ├── capture.html
│   └── player.html
├── dist/                     # Built output
└── PLAN.md                   # Detailed roadmap
```

## Feedboard Agent (Optional)

A Go binary sidecar for advanced features:

- **Auth** - MediaMTX authentication hook
- **Thumbnails** - Stream thumbnail capture via GStreamer
- **Captions** - Real-time speech-to-text via FFmpeg/Whisper
- **Layouts** - Server-side layout persistence
- **Sync** - Multi-user real-time sync

See `PLAN.md` for details.

## License

MIT
