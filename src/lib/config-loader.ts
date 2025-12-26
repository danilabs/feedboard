/**
 * Runtime config loader - loads configuration from config.json or fallbacks.
 *
 * Priority:
 * 1. window.FEEDBOARD_CONFIG (for standalone examples)
 * 2. /config.json file
 * 3. Default MediaMTX ports on same hostname (fallback)
 *
 * Config values:
 * - Empty string "" = use default MediaMTX port on same hostname
 * - "/" = use relative paths (for reverse proxy setups)
 * - Full URL = use that URL
 */

export interface RuntimeConfig {
  api: string
  webrtc: string
  hls: string
  thumbnails?: string
  auth?: {
    enabled: boolean
  }
}

// MediaMTX default ports
const MEDIAMTX_PORTS = {
  api: 9997,
  webrtc: 8889,
  hls: 8888,
}

let loadedConfig: RuntimeConfig | null = null
let configPromise: Promise<RuntimeConfig> | null = null

/**
 * Resolve a config value to a full URL.
 * - Empty string → default MediaMTX port on same hostname
 * - "/" → empty string (relative paths)
 * - Full URL → use as-is
 */
function resolveConfigValue(value: string | undefined, defaultPort: number): string {
  if (value === undefined || value === '') {
    // Empty = use default MediaMTX port
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:${defaultPort}`
  }
  if (value === '/') {
    // Slash = relative paths (for reverse proxy)
    return ''
  }
  // Full URL = use as-is
  return value
}

/**
 * Build default config using current hostname with MediaMTX default ports.
 */
function buildDefaultConfig(): RuntimeConfig {
  const { protocol, hostname } = window.location
  return {
    api: `${protocol}//${hostname}:${MEDIAMTX_PORTS.api}`,
    webrtc: `${protocol}//${hostname}:${MEDIAMTX_PORTS.webrtc}`,
    hls: `${protocol}//${hostname}:${MEDIAMTX_PORTS.hls}`,
  }
}

/**
 * Try to load config.json from the server
 */
async function loadConfigFromJson(): Promise<RuntimeConfig | null> {
  try {
    const res = await fetch('/config.json')
    if (!res.ok) {
      return null
    }
    // Check content-type to avoid parsing HTML as JSON (SPA fallback issue)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return null
    }
    return await res.json()
  } catch {
    // config.json not available or invalid - that's fine
  }
  return null
}

/**
 * Load configuration asynchronously.
 * Checks window.FEEDBOARD_CONFIG first, then tries config.json,
 * then falls back to default MediaMTX ports.
 */
export async function loadConfig(): Promise<RuntimeConfig> {
  // Return cached config if already loaded
  if (loadedConfig) {
    return loadedConfig
  }

  // Return existing promise if loading in progress
  if (configPromise) {
    return configPromise
  }

  configPromise = (async () => {
    // 1. Check window.FEEDBOARD_CONFIG (for standalone examples)
    if (window.FEEDBOARD_CONFIG) {
      loadedConfig = {
        api: resolveConfigValue(window.FEEDBOARD_CONFIG.api, MEDIAMTX_PORTS.api),
        webrtc: resolveConfigValue(window.FEEDBOARD_CONFIG.webrtc, MEDIAMTX_PORTS.webrtc),
        hls: resolveConfigValue(window.FEEDBOARD_CONFIG.hls, MEDIAMTX_PORTS.hls),
        thumbnails: window.FEEDBOARD_CONFIG.thumbnails,
        auth: window.FEEDBOARD_CONFIG.auth
          ? { enabled: true }
          : undefined,
      }
      return loadedConfig
    }

    // 2. Try to load config.json
    const fileConfig = await loadConfigFromJson()
    if (fileConfig) {
      // Resolve empty strings to default ports, "/" to relative paths
      loadedConfig = {
        api: resolveConfigValue(fileConfig.api, MEDIAMTX_PORTS.api),
        webrtc: resolveConfigValue(fileConfig.webrtc, MEDIAMTX_PORTS.webrtc),
        hls: resolveConfigValue(fileConfig.hls, MEDIAMTX_PORTS.hls),
        thumbnails: fileConfig.thumbnails,
        auth: fileConfig.auth,
      }
      return loadedConfig
    }

    // 3. Default: use MediaMTX default ports on same hostname
    loadedConfig = buildDefaultConfig()
    return loadedConfig
  })()

  return configPromise
}

/**
 * Get the loaded config synchronously.
 * Returns null if config hasn't been loaded yet.
 */
export function getLoadedConfig(): RuntimeConfig | null {
  return loadedConfig
}

/**
 * Check if auth is enabled in the loaded config.
 */
export function isAuthEnabled(): boolean {
  return loadedConfig?.auth?.enabled ?? false
}
