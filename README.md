# Feedboard

A browser-based video production toolkit for [MediaMTX](https://github.com/bluenviron/mediamtx). Create multiview layouts, capture local sources, and stream via WebRTC - all from the browser.

**Design Philosophy:** Match MediaMTX's simplicity. Single JS file + HTML. Zero friction.

## Quick Start

```bash
# Install and build
npm install
npm run build

# Serve the dist folder
npx serve dist
```

Or use Docker:

```bash
# Production
docker compose up

# Development (with hot reload)
docker compose -f docker-compose.dev.yml up
```

Open `http://localhost:8080` to use the app.

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

<!-- Local capture with WHIP publish -->
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
| `<feedboard-grid>` | NxN grid layout (1x1 to 4x4) |
| `<feedboard-capture>` | Local capture with optional WHIP publishing |
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
| `label` | string | - | Custom label |
| `show-info` | boolean | `false` | Show info overlay |
| `show-label` | boolean | `false` | Show centered label |
| `show-vu` | boolean | `false` | Show VU meter (WHEP only) |

### `<feedboard-capture>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `camera\|screen\|tab` | `camera` | Capture source |
| `publish-to` | string | - | WHIP publish path |
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
| `framerate` | number | - | For timecode (`:ff`) |

### `<feedboard-slate>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | - | Display text |
| `background` | string | `#000` | Background color |
| `color` | string | `#fff` | Text color |

## Standalone Pages

The dist includes standalone pages that accept URL parameters:

**Player** (`/player.html`)
```
/player.html?src=/stream&server=http://localhost:8889
```

**Capture** (`/capture.html`)
```
/capture.html?path=/webcam&server=http://localhost:8889
```

## Docker Deployment

The included `docker-compose.yml` runs Feedboard with MediaMTX behind Caddy:

```bash
# With automatic HTTPS (self-signed)
docker compose up -d

# With Let's Encrypt (provide your domain)
DOMAIN=feedboard.example.com docker compose up -d
```

This provides:
- **Port 80/443**: Feedboard UI with HTTPS (via Caddy)
- **Port 8554**: RTSP
- **Port 1935**: RTMP

Caddy handles proxying API and WebRTC requests to MediaMTX internally.

### Testing with FFmpeg

```bash
# Push a test stream
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=440:sample_rate=48000 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -c:a aac -f flv rtmp://localhost:1935/test
```

Then open `https://localhost` and view `/test` in the grid.

## MediaMTX Configuration

Feedboard works with MediaMTX defaults. Key ports:

| Port | Protocol |
|------|----------|
| 8889 | WebRTC (WHEP/WHIP) |
| 8888 | HLS |
| 9997 | API |
| 8554 | RTSP |

## Development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Use the included `Caddyfile` to proxy both Vite and MediaMTX through a single port:

```bash
caddy run
# Then open http://localhost:8123
```

## Project Structure

```
feedboard/
├── src/
│   ├── index.ts              # Main exports
│   ├── elements/             # Web components
│   │   ├── feedboard-app.ts
│   │   ├── feedboard-player.ts
│   │   ├── feedboard-grid.ts
│   │   ├── feedboard-capture.ts
│   │   ├── feedboard-clock.ts
│   │   └── feedboard-slate.ts
│   ├── lib/                  # Utilities
│   │   ├── mediamtx-api.ts
│   │   ├── whep-client.ts
│   │   ├── whip-client.ts
│   │   └── hls-player.ts
│   └── types/
├── public/                   # Static assets (copied to dist)
│   ├── index.html
│   ├── player.html
│   ├── capture.html
│   └── examples/
├── dist/                     # Built output
├── docker-compose.yml
├── Dockerfile
└── Caddyfile
```

## License

MIT
