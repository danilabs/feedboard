#!/usr/bin/env node
/**
 * Generate config.json for production deployment.
 *
 * Default behavior (empty config):
 * - HTTPS: relative paths, auth enabled, thumbs enabled
 * - HTTP: direct MediaMTX ports, no auth, no thumbs
 *
 * Override any setting by adding it to this config.
 *
 * Usage: node scripts/generate-config.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')

// Default config - empty uses protocol-based defaults
// Uncomment and edit to override specific settings
const config = {
  // MediaMTX URLs (optional - defaults based on protocol)
  // api: '/',          // Relative paths (behind proxy)
  // api: '',           // Default port on same host
  // api: 'http://...'  // Full URL

  // webrtc: '/',
  // hls: '/',

  // Thumbnails (optional - HTTPS default: enabled, HTTP default: disabled)
  // thumbnails: {
  //   enabled: true,
  //   url: '/',
  // },

  // Auth (optional - HTTPS default: enabled, HTTP default: disabled)
  // auth: {
  //   enabled: true,
  // },
}

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Write config.json
const configPath = resolve(distDir, 'config.json')
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

console.log(`Generated ${configPath}`)
