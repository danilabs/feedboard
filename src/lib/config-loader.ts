/**
 * Runtime config loader - loads configuration from config.json or uses smart defaults.
 *
 * Default behavior based on protocol:
 * - HTTPS: Assumes reverse proxy (Caddy), uses relative paths, auth + thumbs enabled
 * - HTTP: Assumes direct access, uses default MediaMTX ports, no auth/thumbs
 *
 * Config.json can override any of these defaults.
 */

export interface RuntimeConfig {
  api: string
  webrtc: string
  hls: string
  thumbnails?: {
    enabled: boolean
    url?: string
  }
  auth?: {
    enabled: boolean
  }
}

// Default MediaMTX ports for direct access
const DEFAULT_PORTS = {
  api: 9997,
  webrtc: 8889,
  hls: 8888,
  thumbs: 8090,
}

let loadedConfig: RuntimeConfig | null = null
let configPromise: Promise<RuntimeConfig> | null = null

/**
 * Check if we're running over HTTPS (assumed to be behind a reverse proxy).
 */
function isSecure(): boolean {
  return window.location.protocol === 'https:'
}

/**
 * Build URL for direct port access (HTTP mode).
 */
function buildDirectUrl(port: number): string {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}`
}

/**
 * Resolve a config value to a URL.
 * - undefined → use protocol-based default
 * - "/" or "" with HTTPS → relative paths
 * - "" with HTTP → direct port
 * - Full URL → use as-is
 */
function resolveUrl(value: string | undefined, defaultPort: number): string {
  // Explicit full URL
  if (value && value.startsWith('http')) {
    return value
  }

  // Explicit relative path
  if (value === '/') {
    return ''
  }

  // Empty or undefined → use protocol-based default
  if (isSecure()) {
    return '' // Relative paths for HTTPS
  }
  return buildDirectUrl(defaultPort) // Direct port for HTTP
}

/**
 * Resolve thumbnails config.
 * - HTTPS default: enabled with relative paths
 * - HTTP default: disabled
 * - Config can override
 */
function resolveThumbnails(
  config: { enabled?: boolean; url?: string } | undefined
): { enabled: boolean; url?: string } | undefined {
  // Explicit config takes precedence
  if (config !== undefined) {
    if (!config.enabled) {
      return undefined
    }
    return {
      enabled: true,
      url: resolveUrl(config.url, DEFAULT_PORTS.thumbs),
    }
  }

  // Default based on protocol
  if (isSecure()) {
    return { enabled: true, url: '/thumbs' } // HTTPS: enabled via Caddy proxy
  }
  return undefined // HTTP: disabled
}

/**
 * Resolve auth config.
 * - HTTPS default: enabled
 * - HTTP default: disabled
 * - Config can override
 */
function resolveAuth(
  config: { enabled?: boolean } | undefined
): { enabled: boolean } | undefined {
  // Explicit config takes precedence
  if (config !== undefined) {
    return config.enabled ? { enabled: true } : undefined
  }

  // Default based on protocol
  if (isSecure()) {
    return { enabled: true } // HTTPS: enabled
  }
  return undefined // HTTP: disabled
}

/**
 * Try to load config.json from the server.
 */
async function loadConfigFromJson(): Promise<Record<string, any> | null> {
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
    return null
  }
}

/**
 * Load configuration asynchronously.
 * Priority: window.FEEDBOARD_CONFIG > config.json > protocol-based defaults
 */
export async function loadConfig(): Promise<RuntimeConfig> {
  if (loadedConfig) {
    return loadedConfig
  }

  if (configPromise) {
    return configPromise
  }

  configPromise = (async () => {
    // Check window.FEEDBOARD_CONFIG first (for standalone examples)
    const windowConfig = window.FEEDBOARD_CONFIG
    const fileConfig = windowConfig ? null : await loadConfigFromJson()
    const config = windowConfig || fileConfig || {}

    loadedConfig = {
      api: resolveUrl(config.api, DEFAULT_PORTS.api),
      webrtc: resolveUrl(config.webrtc, DEFAULT_PORTS.webrtc),
      hls: resolveUrl(config.hls, DEFAULT_PORTS.hls),
      thumbnails: resolveThumbnails(config.thumbnails),
      auth: resolveAuth(config.auth),
    }

    console.log('[Config] Loaded:', loadedConfig)
    console.log('[Config] Protocol:', window.location.protocol, 'isSecure:', isSecure())
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
