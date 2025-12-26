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
  thumbnails?: {
    enabled: boolean
    url?: string  // resolved URL (empty = default port, "/" = relative, full URL = as-is)
  }
  auth?: {
    enabled: boolean
  }
}

// Default ports
const DEFAULT_PORTS = {
  api: 9997,      // MediaMTX API
  webrtc: 8889,   // MediaMTX WebRTC
  hls: 8888,      // MediaMTX HLS
  thumbs: 8090,   // Thumbnailer
}

let loadedConfig: RuntimeConfig | null = null
let configPromise: Promise<RuntimeConfig> | null = null

/**
 * Resolve a config value to a full URL.
 * - Empty string → default port on same hostname
 * - "/" → empty string (relative paths)
 * - Full URL → use as-is
 */
function resolveConfigValue(value: string | undefined, defaultPort: number): string {
  if (value === undefined || value === '') {
    // Empty = use default port
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
 * Resolve thumbnails config to enabled flag + resolved URL.
 */
function resolveThumbnailsConfig(
  config: { enabled?: boolean; url?: string } | undefined
): { enabled: boolean; url?: string } | undefined {
  if (!config?.enabled) {
    return undefined
  }
  return {
    enabled: true,
    url: resolveConfigValue(config.url, DEFAULT_PORTS.thumbs),
  }
}

/**
 * Build default config using current hostname with default ports.
 */
function buildDefaultConfig(): RuntimeConfig {
  const { protocol, hostname } = window.location
  return {
    api: `${protocol}//${hostname}:${DEFAULT_PORTS.api}`,
    webrtc: `${protocol}//${hostname}:${DEFAULT_PORTS.webrtc}`,
    hls: `${protocol}//${hostname}:${DEFAULT_PORTS.hls}`,
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
        api: resolveConfigValue(window.FEEDBOARD_CONFIG.api, DEFAULT_PORTS.api),
        webrtc: resolveConfigValue(window.FEEDBOARD_CONFIG.webrtc, DEFAULT_PORTS.webrtc),
        hls: resolveConfigValue(window.FEEDBOARD_CONFIG.hls, DEFAULT_PORTS.hls),
        thumbnails: resolveThumbnailsConfig(window.FEEDBOARD_CONFIG.thumbnails as any),
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
        api: resolveConfigValue(fileConfig.api, DEFAULT_PORTS.api),
        webrtc: resolveConfigValue(fileConfig.webrtc, DEFAULT_PORTS.webrtc),
        hls: resolveConfigValue(fileConfig.hls, DEFAULT_PORTS.hls),
        thumbnails: resolveThumbnailsConfig(fileConfig.thumbnails as any),
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
