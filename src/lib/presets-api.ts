/**
 * Preset API client for saving/loading layout configurations.
 */

import type { SlotConfig } from '../elements/feedboard-slot'

export interface PresetConfig {
  layout: string
  cells: SlotConfig[]
}

export interface Preset {
  id: number
  name: string
  config: PresetConfig
  created_by: number
  created_at: string
  updated_at: string
}

/**
 * Fetch all presets from the server.
 * Works without authentication (presets are shared).
 */
export async function listPresets(): Promise<Preset[]> {
  try {
    const res = await fetch('/api/presets', {
      credentials: 'same-origin',
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // API not available
  }
  return []
}

/**
 * Get a single preset by ID.
 */
export async function getPreset(id: number): Promise<Preset | null> {
  try {
    const res = await fetch(`/api/presets/${id}`, {
      credentials: 'same-origin',
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // API not available
  }
  return null
}

/**
 * Create a new preset (admin only).
 */
export async function createPreset(
  name: string,
  config: PresetConfig
): Promise<Preset | null> {
  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, config }),
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // API not available
  }
  return null
}

/**
 * Update an existing preset (admin only).
 */
export async function updatePreset(
  id: number,
  name: string,
  config: PresetConfig
): Promise<Preset | null> {
  try {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, config }),
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // API not available
  }
  return null
}

/**
 * Delete a preset (admin only).
 */
export async function deletePreset(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    return res.ok
  } catch {
    return false
  }
}
