# Feedboard

A browser-based video production toolkit for [MediaMTX](https://github.com/bluenviron/mediamtx). Create multiview layouts, capture local sources, and stream via WebRTC - all from the browser.

## Features

- Multi-view grid layouts (1x1 to 4x4, plus custom layouts)
- WebRTC (WHEP) and HLS playback with automatic fallback
- Local camera/screen capture with WHIP publishing
- Real-time thumbnails via thumbnailer service
- User authentication with JWT tokens
- Stream keys for OBS/encoder access
- VU meters and stream stats overlay
- Keyboard shortcuts for fast operation

## Quick Start

### Docker (Recommended)

```bash
# Development
docker compose -f docker-compose.dev.yml up

# Access at https://localhost
```

On first run, check the authproxy logs for the generated admin password:
```bash
docker compose -f docker-compose.dev.yml logs authproxy | grep Password
```

### Local Development (Mac)

For Safari WebRTC compatibility, run MediaMTX locally:

```bash
# Terminal 1: MediaMTX (download from https://github.com/bluenviron/mediamtx/releases)
./mediamtx

# Terminal 2: Vite dev server
npm install
npm run dev

# Terminal 3: Caddy reverse proxy
caddy run
```

Access via `https://localhost`

### Docker + Local MediaMTX

Best of both worlds - Docker services with local MediaMTX for WebRTC:

```bash
MTX_HOST=host.docker.internal docker compose -f docker-compose.dev.yml up
```

Then run MediaMTX locally in a separate terminal.

## Architecture

```
Browser → Caddy → Feedboard SPA
                → authproxy (Go) → SQLite
                → MediaMTX (streaming)
                → thumbnailer (Go)
```

| Service | Port | Description |
|---------|------|-------------|
| Caddy | 443 | Reverse proxy, TLS termination |
| MediaMTX | 8554, 1935, 8889, 8888, 9997 | RTSP, RTMP, WebRTC, HLS, API |
| authproxy | 8091 | Authentication, stream keys |
| thumbnailer | 8090 | Live thumbnail generation |

## Production Deployment

```bash
# Set required secrets
export JWT_SECRET=$(openssl rand -hex 32)
export THUMBNAILER_TOKEN=$(openssl rand -hex 32)
export DOMAIN=yourdomain.com

# Start production stack
docker compose up -d
```

For local testing with self-signed certs:
```bash
DOMAIN=:443 TLS_MODE=internal docker compose up -d
```

## Configuration

### MediaMTX Setup

Add to `mediamtx.yml` for authentication hook:

```yaml
api: yes
apiAddress: :9997

# Authentication hook
authMethod: http
authHTTPAddress: http://localhost:8091/auth/hook

# CORS (if not behind proxy)
apiAllowOrigin: '*'
webrtcAllowOrigin: '*'
hlsAllowOrigin: '*'
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT signing | Required in production |
| `THUMBNAILER_TOKEN` | Service account token | Required for thumbnailer |
| `DOMAIN` | Domain for Let's Encrypt | `:443` (self-signed) |
| `MTX_HOST` | MediaMTX hostname | `mediamtx` (Docker) |

## Usage

### Admin Panel

Access `/admin` to manage:
- Users (create, edit roles)
- Stream keys (for OBS/encoders)

### Stream Keys

Generate stream keys in the admin panel. Use them with:

**RTMP:**
```
Server: rtmp://yourserver:1935/
Stream Key: streampath?key=YOUR_KEY
```

**SRT:**
```
srt://yourserver:8890?streamid=#!::m=publish,r=streampath,s=YOUR_KEY
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
./dev/test-streams.sh         # Add all test streams
./dev/test-streams.sh remove  # Remove all test streams
./dev/test-streams.sh list    # List current paths
```

Available test streams:
| Stream | Description |
|--------|-------------|
| `test_bars` | SMPTE HD bars + 1kHz tone |
| `testsrc` | Test pattern with timecode |
| `gradient` | Animated color gradient |
| `pal_bars` | PAL 75% color bars |
| `color_red` | Solid red |
| `color_green` | Solid green |
| `color_blue` | Solid blue |

### Manual FFmpeg Test

```bash
# Push test stream via RTMP
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=440:sample_rate=48000 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -c:a aac -f flv rtmp://localhost:1935/test

# With authentication
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -f flv "rtmp://localhost:1935/test?key=YOUR_STREAM_KEY"
```

## Project Structure

```
feedboard/
├── src/
│   ├── elements/           # Lit web components
│   ├── lib/                # Utilities (config, clients)
│   └── routes/             # SPA routes
├── authproxy/              # Go authentication service
├── thumbnailer/            # Go thumbnail service
├── docker-compose.yml      # Production stack
├── docker-compose.dev.yml  # Development stack
├── Caddyfile.docker        # Production Caddy config
├── Caddyfile.dev           # Development Caddy config
└── mediamtx.yml            # MediaMTX configuration
```

## Troubleshooting

### Safari WebRTC Issues

Safari has strict WebRTC/ICE requirements. For local development on Mac:
1. Run MediaMTX locally (not in Docker)
2. Use `MTX_HOST=host.docker.internal` for Docker services
3. Or use HLS fallback (higher latency)

### CORS Errors

Ensure MediaMTX has CORS configured:
```yaml
apiAllowOrigin: '*'
webrtcAllowOrigin: '*'
hlsAllowOrigin: '*'
```

Or use Caddy/nginx to proxy everything through one origin.

### Authentication Failures

Check authproxy logs:
```bash
docker compose logs authproxy
```

Ensure `JWT_SECRET` is set and consistent across restarts.

## License

MIT
