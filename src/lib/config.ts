/**
 * Centralized configuration for MediaMTX server URLs.
 *
 * Override by defining window.FEEDBOARD_CONFIG before loading feedboard.js:
 *
 * @example
 * // Custom ports
 * window.FEEDBOARD_CONFIG = {
 *   api: 'http://localhost:9000',
 *   webrtc: 'http://localhost:8000',
 *   hls: 'http://localhost:8001',
 * }
 *
 * @example
 * // Behind reverse proxy (relative URLs)
 * window.FEEDBOARD_CONFIG = {
 *   api: '',
 *   webrtc: '',
 *   hls: '',
 * }
 */

declare global {
  interface Window {
    FEEDBOARD_CONFIG?: {
      api?: string
      webrtc?: string
      hls?: string
    }
  }
}

// MediaMTX default ports
const DEFAULTS = {
  apiPort: 9997,
  webrtcPort: 8889,
  hlsPort: 8888,
}

export interface FeedboardConfig {
  api: string
  webrtc: string
  hls: string
}

let cachedConfig: FeedboardConfig | null = null

/**
 * Get the current configuration.
 * Checks for window.FEEDBOARD_CONFIG override, then applies smart defaults.
 *
 * Default behavior:
 * - Uses current hostname with MediaMTX default ports (8889, 8888, 9997)
 * - Works with: python -m http.server + default MediaMTX config
 *
 * For proxy setups (Caddy, nginx), set window.FEEDBOARD_CONFIG:
 * - { api: '', webrtc: '', hls: '' } for relative URLs (same origin)
 */
export function getConfig(): FeedboardConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  // Check for user override
  if (window.FEEDBOARD_CONFIG) {
    cachedConfig = {
      api: window.FEEDBOARD_CONFIG.api ?? '',
      webrtc: window.FEEDBOARD_CONFIG.webrtc ?? '',
      hls: window.FEEDBOARD_CONFIG.hls ?? '',
    }
    return cachedConfig
  }

  // Default: use current hostname with MediaMTX default ports
  const { protocol, hostname } = window.location
  cachedConfig = {
    api: `${protocol}//${hostname}:${DEFAULTS.apiPort}`,
    webrtc: `${protocol}//${hostname}:${DEFAULTS.webrtcPort}`,
    hls: `${protocol}//${hostname}:${DEFAULTS.hlsPort}`,
  }
  return cachedConfig
}

/**
 * Get the API base URL (for MediaMTX REST API)
 */
export function getApiUrl(): string {
  return getConfig().api
}

/**
 * Get the WebRTC base URL (for WHEP/WHIP)
 */
export function getWebrtcUrl(): string {
  return getConfig().webrtc
}

/**
 * Get the HLS base URL
 */
export function getHlsUrl(): string {
  return getConfig().hls
}

/**
 * Build a WHEP URL for a given stream path
 */
export function buildWhepUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const base = getWebrtcUrl()
  return base ? `${base}/${cleanPath}/whep` : `/${cleanPath}/whep`
}

/**
 * Build a WHIP URL for a given stream path
 */
export function buildWhipUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const base = getWebrtcUrl()
  return base ? `${base}/${cleanPath}/whip` : `/${cleanPath}/whip`
}

/**
 * Build an HLS URL for a given stream path
 */
export function buildHlsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const base = getHlsUrl()
  return base ? `${base}/${cleanPath}/index.m3u8` : `/${cleanPath}/index.m3u8`
}
