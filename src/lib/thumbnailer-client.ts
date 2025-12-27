/**
 * Client for the thumbnailer WebSocket service.
 * Receives live thumbnail updates and stream list changes.
 */

import { getThumbnailsUrl } from './config'

export interface ThumbnailMessage {
  type: 'thumbnail'
  stream: string
  timestamp: number
  width: number
  height: number
  data: string // base64 encoded JPEG
}

export interface StreamInfo {
  name: string
  ready: boolean
  source?: string
  tracks?: string[]
}

export interface StreamsMessage {
  type: 'streams'
  streams: StreamInfo[]
}

type Message = ThumbnailMessage | StreamsMessage

export type ThumbnailCallback = (stream: string, dataUrl: string, timestamp: number) => void
export type StreamsCallback = (streams: StreamInfo[]) => void
export type ConnectionCallback = (connected: boolean) => void

export class ThumbnailerClient {
  private ws: WebSocket | null = null
  private reconnectTimer: number | null = null
  private thumbnails: Map<string, string> = new Map() // stream -> data URL
  private onThumbnail: ThumbnailCallback | null = null
  private onStreams: StreamsCallback | null = null
  private onConnection: ConnectionCallback | null = null
  private connected = false

  constructor() {}

  /**
   * Connect to the thumbnailer WebSocket
   */
  connect(): void {
    const base = getThumbnailsUrl()
    console.log('[Thumbnailer] connect() base:', base)
    if (base === undefined) return

    const wsUrl = base.replace(/^http/, 'ws') + '/ws'
    console.log('[Thumbnailer] Connecting to:', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.connected = true
        console.log('Thumbnailer WebSocket connected')
        if (this.onConnection) this.onConnection(true)
      }

      this.ws.onclose = () => {
        this.connected = false
        console.log('Thumbnailer WebSocket disconnected')
        if (this.onConnection) this.onConnection(false)
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        // Will trigger onclose
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: Message = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (e) {
          console.warn('Failed to parse thumbnailer message:', e)
        }
      }
    } catch (e) {
      console.warn('Failed to connect to thumbnailer:', e)
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /**
   * Set callback for thumbnail updates
   */
  setThumbnailCallback(callback: ThumbnailCallback | null): void {
    this.onThumbnail = callback
  }

  /**
   * Set callback for stream list updates
   */
  setStreamsCallback(callback: StreamsCallback | null): void {
    this.onStreams = callback
  }

  /**
   * Set callback for connection state changes
   */
  setConnectionCallback(callback: ConnectionCallback | null): void {
    this.onConnection = callback
  }

  /**
   * Get the latest thumbnail data URL for a stream
   */
  getThumbnail(stream: string): string | undefined {
    return this.thumbnails.get(stream)
  }

  /**
   * Check if connected to thumbnailer
   */
  isConnected(): boolean {
    return this.connected
  }

  private handleMessage(msg: Message): void {
    switch (msg.type) {
      case 'thumbnail':
        const dataUrl = `data:image/jpeg;base64,${msg.data}`
        this.thumbnails.set(msg.stream, dataUrl)
        if (this.onThumbnail) {
          this.onThumbnail(msg.stream, dataUrl, msg.timestamp)
        }
        break

      case 'streams':
        if (this.onStreams) {
          this.onStreams(msg.streams)
        }
        break
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }
}

// Singleton instance
let instance: ThumbnailerClient | null = null

export function getThumbnailerClient(): ThumbnailerClient {
  if (!instance) {
    instance = new ThumbnailerClient()
  }
  return instance
}
