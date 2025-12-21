# Feedboard

A browser-based video production toolkit for [MediaMTX](https://github.com/bluenviron/mediamtx). Create multiview layouts, capture local sources, and stream via WebRTC - all from the browser.

**Design Philosophy:** Match MediaMTX's simplicity. Single JS file + HTML. Zero friction.

## Quick Start (Production)

```bash
# Build
npm install
npm run build

# Serve dist folder on any port
cd dist
python -m http.server 8000

# Run MediaMTX with defaults (separate terminal)
./mediamtx
```

Open `http://localhost:8000` - components automatically connect to MediaMTX on its default ports.

## Configuration

By default, Feedboard uses the current hostname with MediaMTX default ports:
- **API:** `hostname:9997`
- **WebRTC:** `hostname:8889`
- **HLS:** `hostname:8888`

### Custom Configuration

Override defaults by defining `window.FEEDBOARD_CONFIG` before loading feedboard.js:

```html
<script>
window.FEEDBOARD_CONFIG = {
  api: 'http://myserver:9997',
  webrtc: 'http://myserver:8889',
  hls: 'http://myserver:8888',
}
</script>
<script type="module" src="feedboard.js"></script>
```

### Behind a Reverse Proxy

If Caddy/nginx proxies everything through one origin, use relative URLs:

```html
<script>
window.FEEDBOARD_CONFIG = {
  api: '',
  webrtc: '',
  hls: '',
}
</script>
```

## MediaMTX Setup

Feedboard requires CORS headers when accessing MediaMTX from a different port. Add to `mediamtx.yml`:

```yaml
api: yes
apiAddress: :9997
apiAllowOrigin: '*'

webrtc: yes
webrtcAddress: :8889
webrtcAllowOrigin: '*'

hls: yes
hlsAddress: :8888
hlsAllowOrigin: '*'
```

### Default Ports

| Port | Protocol |
|------|----------|
| 9997 | REST API |
| 8889 | WebRTC (WHEP/WHIP) |
| 8888 | HLS |
| 8554 | RTSP |
| 1935 | RTMP |

## Development

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173`. For full functionality, run MediaMTX and use Caddy to proxy both through one origin:

```bash
# Terminal 1: Vite
npm run dev

# Terminal 2: MediaMTX
./mediamtx

# Terminal 3: Caddy (proxies both Vite and MediaMTX)
caddy run
```

Then access via `https://localhost` (Caddy). For external access, use ngrok:

```bash
ngrok http https://localhost
```

### Caddyfile Example

```caddyfile
{
  auto_https disable_redirects
}

:443, localhost {
  tls internal

  # Vite dev server
  reverse_proxy /src/* localhost:5173
  reverse_proxy /@* localhost:5173
  reverse_proxy /node_modules/* localhost:5173

  # MediaMTX API
  reverse_proxy /v3/* localhost:9997

  # MediaMTX WebRTC
  reverse_proxy /*/whep localhost:8889
  reverse_proxy /*/whip localhost:8889

  # MediaMTX HLS
  reverse_proxy /*.m3u8 localhost:8888
  reverse_proxy /*.ts localhost:8888

  # Everything else to Vite
  reverse_proxy localhost:5173
}
```

## Usage

### Full Application

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="feedboard.js"></script>
</head>
<body>
  <feedboard-app></feedboard-app>
</body>
</html>
```

### Individual Components

```html
<script type="module" src="feedboard.js"></script>

<!-- Video player (WHEP/HLS auto-detect) -->
<feedboard-player src="/camera1"></feedboard-player>

<!-- Grid layout -->
<feedboard-grid layout="2x2">
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

### Explicit Server Override

Components accept a `server` attribute to override the global config:

```html
<feedboard-player src="/stream" server="http://other-server:8889"></feedboard-player>
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
| `S` | Toggle sidebar |
| `1-9` | Select cell |
| `0` | Deselect |
| `L` | Toggle labels |
| `U` | Toggle VU meters |
| `I` | Toggle info overlay |
| `G` | Cycle grid layout |
| `F` | Toggle fullscreen |
| `Enter` | Fullscreen selected cell |
| `Escape` | Exit fullscreen/close sidebar |
| `Delete` | Clear selected cell |
| Arrow keys | Navigate cells |

## Component Attributes

### `<feedboard-player>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | required | Stream path or full URL |
| `server` | string | - | Override server URL |
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
| `server` | string | - | Override server URL |
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

Copy these from `public/` to your dist folder:

**Player** (`player.html`)
```
player.html?src=/stream
player.html?src=/stream&server=http://custom:8889
```

**Capture** (`capture.html`)
```
capture.html?path=/webcam
capture.html?path=/webcam&server=http://custom:8889
```

**Annotate** (`annotate.html`) - Draw on streams and republish
```
annotate.html?src=/input&publish=/output
```

## Testing with FFmpeg

```bash
# Push a test stream via RTMP
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=440:sample_rate=48000 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -c:a aac -f flv rtmp://localhost:1935/test

# Or via RTSP
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -f rtsp rtsp://localhost:8554/test
```

Then view `/test` in the multiviewer.

## Programmatic Usage

```javascript
import {
  MediaMTXClient,
  WhepClient,
  WhipClient,
  getConfig,
  buildWhepUrl,
  buildWhipUrl
} from './feedboard.js'

// Get current config
const config = getConfig()
console.log(config.webrtc) // e.g., "http://localhost:8889"

// Build URLs
const whepUrl = buildWhepUrl('/mystream') // "http://localhost:8889/mystream/whep"

// Use clients directly
const client = new MediaMTXClient(config.api)
const streams = await client.listPaths()
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
│   └── lib/                  # Utilities
│       ├── config.ts         # Centralized configuration
│       ├── mediamtx-api.ts   # REST API client
│       ├── whep-client.ts    # WebRTC playback
│       ├── whip-client.ts    # WebRTC publishing
│       └── hls-player.ts     # HLS playback
├── public/                   # HTML pages (copy to dist)
│   ├── index.html
│   ├── player.html
│   ├── capture.html
│   └── annotate.html
└── dist/                     # Built output (feedboard.js)
```

## License

MIT
