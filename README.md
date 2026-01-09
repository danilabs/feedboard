<p align="center">
  <img src="assets/logo.svg" alt="Feedboard" width="120" height="120">
</p>

# Feedboard

A browser-based video production toolkit for [MediaMTX](https://github.com/bluenviron/mediamtx). Create multiview layouts, capture local sources, and stream via WebRTC.

## Features

- Multi-view grid layouts (1x1 to 4x4, plus custom layouts)
- WebRTC (WHEP) and HLS playback
- Local camera/screen/tab capture with WHIP publishing
- Real-time thumbnails via thumbnailer service
- User authentication with JWT tokens
- Stream keys for RTMP/SRT/webRTC ingress/egres
- VU meters and stream stats overlay
- Keyboard shortcuts for fast operation

## Prerequisites

- **Docker** with Docker Compose
- **Node.js 20+**
- **Caddy**

### macOS Notes

For WebRTC to work in Docker on macOS, enable **host networking** in Docker Desktop:
Settings → Features in development → Enable host networking

## Quick Start

### Docker

```bash
cp .env.template .env
docker compose -f docker-compose.dev.yml up

# Access at https://localhost
```

### Local Development

```bash
# Terminal 1: MediaMTX
./mediamtx

# Terminal 2: Vite dev server
npm install
npm run dev

# Terminal 3: Caddy reverse proxy
caddy run
```

Access via `https://localhost`

## Architecture

```
Browser → Caddy → Feedboard SPA
                → authproxy (Go) → SQLite
                → MediaMTX (streaming)
                → thumbnailer (Go)
```

| Service | Port | Description |
|---------|------|-------------|
| Caddy | 80, 443 | Reverse proxy, TLS |
| MediaMTX | 1935, 8189, 8554, 8888, 8889, 8890, 9997 | RTMP, WebRTC UDP, RTSP, HLS, WebRTC HTTP, SRT, API |
| authproxy | 8091 | Authentication, stream keys |
| thumbnailer | 8090 | Live thumbnail generation |

## Production Deployment

```bash
cp .env.template .env
# Edit .env - see Configuration section for variables
docker compose up -d
```

### AWS EC2 / Cloud Deployment

For WebRTC to work from external clients, MediaMTX needs to advertise a public IP. Edit within `mediamtx.yml`:

```yaml
webrtcAdditionalHosts: [EC2_PUBLIC_IP]
```

Ensure the security group allows the following ports:
- TCP 80 (HTTP, for Let's Encrypt)
- TCP 443 (HTTPS)
- TCP 1935 (RTMP)
- UDP 8189 (WebRTC)
- TCP 8554 (RTSP, if needed)
- UDP 8890 (SRT)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT signing | Required |
| `THUMBNAILER_TOKEN` | Service account token | Optional |
| `DOMAIN` | Domain for Let's Encrypt | `:443` (self-signed) |
| `MTX_HOST` | MediaMTX hostname | `mediamtx` |

Generate secure secrets with: `openssl rand -hex 32`

## Usage

### Admin Panel

Access `/admin` to manage:
- Users (create, edit roles)
- Stream keys (for OBS/encoders)

### Stream Keys

Generate stream keys in the admin panel. Use them with:

**RTMP:**
```
Server: rtmp://server:1935/
Stream Key: streampath?key=STREAM_KEY
```

**SRT:**
```
srt://server:8890?streamid=publish:streampath:stream:STREAM_KEY
```

### Components

```html
<!-- Full application -->
<feedboard-app></feedboard-app>

<!-- Video player -->
<feedboard-player src="/camera1"></feedboard-player>

<!-- Local capture with WHIP publish -->
<feedboard-capture type="camera" publish-to="/webcam"></feedboard-capture>

<!-- Clock -->
<feedboard-clock format="HH:mm:ss" timezone="America/New_York"></feedboard-clock>
```

### Standalone Component Examples

Demo pages showing components outside the main app:

```bash
./mediamtx                # Terminal 1
./dev/test-streams.sh     # Terminal 2
npm run dev               # Terminal 3

# Access examples at:
# http://localhost:5173/examples/components-demo.html
# http://localhost:5173/examples/clocks.html
```

Note: Some components require the MediaMTX API enabled to function.

### Keyboard Shortcuts

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
| `muted` | boolean | `true` | Start muted (for autoplay) |
| `autoplay` | boolean | `true` | Auto-connect on load |
| `show-info` | boolean | `false` | Show info overlay |
| `show-label` | boolean | `false` | Show centered label |
| `show-vu` | boolean | `false` | Show VU meter (WHEP only) |

### `<feedboard-capture>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `camera\|screen\|tab` | `camera` | Capture source |
| `publish-to` | string | - | WHIP publish path |
| `server` | string | - | Override server URL |
| `resolution` | `720p\|1080p\|4k` | `1080p` | Video resolution |

### `<feedboard-clock>`

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `HH:mm:ss` | Time format |
| `timezone` | string | local | IANA timezone |
| `label` | string | - | Display label |

## Test Streams

Add test streams to MediaMTX for development:

```bash
./dev/test-streams.sh
```

### Loop MP4 File

Stream an MP4 file to RTMP (loops forever):

```bash
./dev/play-mp4.sh video.mp4 streamname

# With stream key
./dev/play-mp4.sh video.mp4 "mystream?key=STREAM_KEY"

# To remote server
RTMP_SERVER=rtmp://server:1935 ./dev/play-mp4.sh video.mp4 demo
```

## License

MIT
