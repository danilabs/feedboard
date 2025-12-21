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

export interface FeedboardUser {
  id: number
  username: string
  role: 'viewer' | 'publisher' | 'admin'
}

declare global {
  interface Window {
    FEEDBOARD_CONFIG?: {
      api?: string
      webrtc?: string
      hls?: string
      thumbnails?: string
      auth?: string  // Auth API base URL (if auth is enabled)
    }
    FEEDBOARD_USER?: FeedboardUser | null  // Injected by auth proxy when logged in
  }
}

// MediaMTX default ports
const DEFAULTS = {
  apiPort: 9997,
  webrtcPort: 8889,
  hlsPort: 8888,
  thumbnailsPort: 8090,
}

export interface FeedboardConfig {
  api: string
  webrtc: string
  hls: string
  thumbnails?: string  // Optional - thumbnailer service URL
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
      thumbnails: window.FEEDBOARD_CONFIG.thumbnails,  // Optional, undefined if not set
    }
    return cachedConfig
  }

  // Default: use current hostname with MediaMTX default ports
  const { protocol, hostname } = window.location
  cachedConfig = {
    api: `${protocol}//${hostname}:${DEFAULTS.apiPort}`,
    webrtc: `${protocol}//${hostname}:${DEFAULTS.webrtcPort}`,
    hls: `${protocol}//${hostname}:${DEFAULTS.hlsPort}`,
    thumbnails: `${protocol}//${hostname}:${DEFAULTS.thumbnailsPort}`,
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

/**
 * Get the thumbnails base URL (for thumbnailer service)
 * Returns undefined if thumbnailer is not configured
 */
export function getThumbnailsUrl(): string | undefined {
  return getConfig().thumbnails
}

/**
 * Build a thumbnail URL for a given stream path
 * Returns undefined if thumbnailer is not configured
 */
export function buildThumbnailUrl(path: string): string | undefined {
  const base = getThumbnailsUrl()
  if (!base) return undefined
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}/api/streams/${cleanPath}/thumbnail.jpg`
}

/**
 * Check if auth is enabled
 */
export function isAuthEnabled(): boolean {
  return !!window.FEEDBOARD_CONFIG?.auth
}

/**
 * Get the auth API base URL
 * Returns undefined if auth is not configured
 */
export function getAuthUrl(): string | undefined {
  return window.FEEDBOARD_CONFIG?.auth
}

/**
 * Get the current user (if logged in via auth proxy)
 * Returns null if not logged in or auth not enabled
 */
export function getCurrentUser(): FeedboardUser | null {
  return window.FEEDBOARD_USER ?? null
}

/**
 * Check if the current user has a specific role or higher
 */
export function hasRole(role: 'viewer' | 'publisher' | 'admin'): boolean {
  const user = getCurrentUser()
  if (!user) return false

  const roles = ['viewer', 'publisher', 'admin']
  const userLevel = roles.indexOf(user.role)
  const requiredLevel = roles.indexOf(role)

  return userLevel >= requiredLevel
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
  return getCurrentUser()?.role === 'admin'
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  })
  cachedStreamToken = null
  window.location.href = '/login.html'
}

// Stream token cache
let cachedStreamToken: string | null = null
let tokenFetchPromise: Promise<string | null> | null = null

/**
 * Get a JWT token for stream authentication.
 * This token can be passed to WHEP/WHIP URLs as ?jwt=xxx
 * Returns null if not authenticated.
 */
export async function getStreamToken(): Promise<string | null> {
  // Return cached token if available
  if (cachedStreamToken) {
    return cachedStreamToken
  }

  // If already fetching, wait for that request
  if (tokenFetchPromise) {
    return tokenFetchPromise
  }

  // Fetch a new token
  tokenFetchPromise = (async () => {
    try {
      const res = await fetch('/auth/token', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        cachedStreamToken = data.token
        return cachedStreamToken
      }
    } catch {
      // Not authenticated or auth not available
    }
    return null
  })()

  const token = await tokenFetchPromise
  tokenFetchPromise = null
  return token
}

/**
 * Clear the cached stream token (call on logout or auth change)
 */
export function clearStreamToken(): void {
  cachedStreamToken = null
}
