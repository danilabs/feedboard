/**
 * PPM Meter - Broadcast-standard audio level metering
 *
 * Uses AudioWorklet for sample-accurate, low-latency metering
 * with proper PPM ballistics (DIN Type II by default).
 */

import { getPPMWorkletUrl, type PPMMeterData } from './ppm-worklet'

export type { PPMMeterData }

export interface PPMMeterOptions {
  onData?: (data: PPMMeterData) => void
}

// Cache the worklet blob URL (can be reused across contexts)
let workletUrl: string | null = null

// Track which AudioContexts have the worklet registered
const registeredContexts = new WeakSet<AudioContext>()

export class PPMMeter {
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private onData: ((data: PPMMeterData) => void) | null = null
  private stream: MediaStream | null = null

  constructor(options: PPMMeterOptions = {}) {
    this.onData = options.onData || null
  }

  /**
   * Initialize AudioContext and register worklet
   */
  private async initContext(): Promise<AudioContext | null> {
    this.audioContext = new AudioContext()

    // Check if AudioWorklet is available (requires secure context: HTTPS or localhost)
    if (!this.audioContext.audioWorklet) {
      console.warn('[PPMMeter] AudioWorklet not available - requires HTTPS or localhost')
      this.audioContext.close()
      this.audioContext = null
      return null
    }

    // Create worklet URL once
    if (!workletUrl) {
      workletUrl = getPPMWorkletUrl()
    }

    // Register worklet on this context if not already done
    if (!registeredContexts.has(this.audioContext)) {
      await this.audioContext.audioWorklet.addModule(workletUrl)
      registeredContexts.add(this.audioContext)
    }

    return this.audioContext
  }

  /**
   * Set up worklet node and message handler
   */
  private setupWorkletNode(): void {
    if (!this.audioContext || !this.sourceNode) return

    this.workletNode = new AudioWorkletNode(this.audioContext, 'ppm-meter-processor')

    // Listen for meter data
    this.workletNode.port.onmessage = (event) => {
      if (this.onData) {
        this.onData(event.data as PPMMeterData)
      }
    }

    // Connect source -> worklet
    this.sourceNode.connect(this.workletNode)
  }

  /**
   * Connect to a MediaStream and start metering
   * Returns true on success, false on failure
   */
  async connect(stream: MediaStream): Promise<boolean> {
    // Check for audio tracks
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return false

    this.stream = stream

    const ctx = await this.initContext()
    if (!ctx) return false

    // Create source from stream
    this.sourceNode = ctx.createMediaStreamSource(stream)
    this.setupWorkletNode()

    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    return true
  }

  /**
   * Update the data callback
   */
  setOnData(callback: (data: PPMMeterData) => void): void {
    this.onData = callback
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode.port.onmessage = null
      this.workletNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.stream = null
  }

  /**
   * Check if meter is connected
   */
  get isConnected(): boolean {
    return this.audioContext !== null && this.workletNode !== null
  }
}

/**
 * Utility: Convert dBFS to percentage for display
 * Maps -60dB to 0% and 0dB to 100%
 */
export function dbfsToPercent(dbfs: number, minDb: number = -60): number {
  if (dbfs <= minDb) return 0
  if (dbfs >= 0) return 100
  return ((dbfs - minDb) / (0 - minDb)) * 100
}

/**
 * Utility: Get color for dBFS level (green -> yellow -> red)
 */
export function dbfsToColor(dbfs: number): string {
  if (dbfs >= -6) return '#dc2626'   // Red: -6 to 0 dBFS
  if (dbfs >= -12) return '#eab308'  // Yellow: -12 to -6 dBFS
  return '#22c55e'                    // Green: below -12 dBFS
}
