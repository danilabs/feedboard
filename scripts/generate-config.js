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
  // "/" = relative paths (for reverse proxy setups)
  // "" = use default MediaMTX ports on same hostname
  // Full URL = use that URL
  api: '/',
  webrtc: '/',
  hls: '/',

  // Optional thumbnailer service
  thumbnails: '',

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
