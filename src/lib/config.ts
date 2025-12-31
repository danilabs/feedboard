/**
 * Centralized configuration for MediaMTX server URLs.
 *
 * Configuration priority:
 * 1. window.FEEDBOARD_CONFIG (for standalone examples)
 * 2. /config.json file (for production deployments)
 * 3. Relative paths (for reverse proxy setups)
 *
 * @example
 * // Custom ports via window.FEEDBOARD_CONFIG
 * window.FEEDBOARD_CONFIG = {
 *   api: 'http://localhost:9000',
 *   webrtc: 'http://localhost:8000',
 *   hls: 'http://localhost:8001',
 * }
 *
 * @example
 * // Or edit config.json before serving:
 * {
 *   "api": "http://mediamtx.local:9997",
 *   "webrtc": "http://mediamtx.local:8889",
 *   "hls": "http://mediamtx.local:8888"
 * }
 */

import { loadConfig, getLoadedConfig, isAuthEnabled as checkAuthEnabled } from './config-loader'

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
      thumbnails?: { enabled?: boolean; url?: string }
      auth?: string | { enabled: boolean }  // Auth config
    }
    FEEDBOARD_USER?: FeedboardUser | null  // Injected by auth proxy when logged in
  }
}

export interface FeedboardConfig {
  api: string
  webrtc: string
  hls: string
  thumbnails?: string  // Optional - thumbnailer service URL
}

let cachedConfig: FeedboardConfig | null = null
let configInitialized = false

/**
 * Initialize configuration asynchronously.
 * Call this once at app startup before using getConfig().
 */
export async function initConfig(): Promise<FeedboardConfig> {
  const runtime = await loadConfig()
  cachedConfig = {
    api: runtime.api,
    webrtc: runtime.webrtc,
    hls: runtime.hls,
    thumbnails: runtime.thumbnails?.url,
  }
  configInitialized = true
  return cachedConfig
}

// MediaMTX default ports
const MEDIAMTX_PORTS = {
  api: 9997,
  webrtc: 8889,
  hls: 8888,
}

/**
 * Resolve a config value to a full URL.
 * - Empty string → default MediaMTX port on same hostname
 * - "/" → empty string (relative paths)
 * - Full URL → use as-is
 */
function resolveValue(value: string | undefined, defaultPort: number): string {
  if (value === undefined || value === '') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:${defaultPort}`
  }
  if (value === '/') {
    return ''
  }
  return value
}

/**
 * Get the current configuration.
 * Returns cached config if initialized, otherwise falls back to sync detection.
 *
 * For SPA usage, call initConfig() first.
 * For standalone examples, this works immediately with window.FEEDBOARD_CONFIG.
 */
export function getConfig(): FeedboardConfig {
  // Return initialized config
  if (cachedConfig) {
    return cachedConfig
  }

  // Sync fallback for components that call before init
  // Check for user override
  if (window.FEEDBOARD_CONFIG) {
    const thumbs = window.FEEDBOARD_CONFIG.thumbnails
    cachedConfig = {
      api: resolveValue(window.FEEDBOARD_CONFIG.api, MEDIAMTX_PORTS.api),
      webrtc: resolveValue(window.FEEDBOARD_CONFIG.webrtc, MEDIAMTX_PORTS.webrtc),
      hls: resolveValue(window.FEEDBOARD_CONFIG.hls, MEDIAMTX_PORTS.hls),
      thumbnails: thumbs?.enabled ? resolveValue(thumbs.url, 8090) : undefined,
    }
    return cachedConfig
  }

  // Default: use MediaMTX default ports on same hostname
  const { protocol, hostname } = window.location
  cachedConfig = {
    api: `${protocol}//${hostname}:${MEDIAMTX_PORTS.api}`,
    webrtc: `${protocol}//${hostname}:${MEDIAMTX_PORTS.webrtc}`,
    hls: `${protocol}//${hostname}:${MEDIAMTX_PORTS.hls}`,
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
  if (base === undefined) return undefined
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}/api/streams/${cleanPath}/thumbnail.jpg`
}

/**
 * Check if auth is enabled
 */
export function isAuthEnabled(): boolean {
  // Check loaded config first (from config.json)
  if (checkAuthEnabled()) {
    return true
  }
  // Fall back to window config
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
  window.location.href = '/login'
}

// Stream token cache
let cachedStreamToken: string | null = null
let tokenFetchPromise: Promise<string | null> | null = null

/**
 * Get a JWT token for stream authentication.
 * This token can be passed to WHEP/WHIP URLs as ?jwt=xxx
 * Returns null if auth is disabled or not authenticated.
 */
export async function getStreamToken(): Promise<string | null> {
  // Skip if auth is disabled
  if (!isAuthEnabled()) {
    return null
  }

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
