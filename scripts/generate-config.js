#!/usr/bin/env node
/**
 * Generate config.json for production deployment.
 *
 * This creates a config file with default values that can be edited
 * before serving the built application.
 *
 * Usage: node scripts/generate-config.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')

// Default config - edit these values before serving
const config = {
  // MediaMTX server URLs
  // "" = use default ports on same hostname (api:9997, webrtc:8889, hls:8888)
  // "/" = relative paths (for reverse proxy setups where all services are on same origin)
  // Full URL = use that URL (e.g., "http://mediamtx.local:9997")
  api: '',
  webrtc: '',
  hls: '',

  // Optional thumbnailer service
  // enabled: true/false - whether to use thumbnailer
  // url: "" = default port 8090, "/" = relative paths, or full URL
  thumbnails: {
    enabled: false,
  },

  // Authentication settings
  auth: {
    enabled: false,
  },
}

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Write config.json
const configPath = resolve(distDir, 'config.json')
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

console.log(`Generated ${configPath}`)
