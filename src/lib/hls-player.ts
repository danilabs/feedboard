import Hls from 'hls.js'

export class HlsPlayer {
  private hls: Hls | null = null
  private token: string | null = null
  public onError: ((error: string) => void) | null = null

  constructor(
    private url: string,
    private videoElement: HTMLVideoElement
  ) {}

  /** Set JWT token for authenticated playback */
  setToken(token: string | null): void {
    this.token = token
  }

  connect(): void {
    console.log('[HLS] Connecting to:', this.url)

    if (Hls.isSupported()) {
      const config: Partial<Hls['config']> = {
        enableWorker: true,
        lowLatencyMode: true,
      }

      // Add JWT auth header if token is set
      if (this.token) {
        config.xhrSetup = (xhr: XMLHttpRequest) => {
          xhr.setRequestHeader('Authorization', `Bearer ${this.token}`)
        }
      }

      this.hls = new Hls(config)

      this.hls.loadSource(this.url)
      this.hls.attachMedia(this.videoElement)

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest parsed, playing')
        this.videoElement.play().catch(() => {})
      })

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[HLS] Error:', data.type, data.details, data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS] Fatal network error, trying to recover')
              this.hls?.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS] Fatal media error, trying to recover')
              this.hls?.recoverMediaError()
              break
            default:
              console.error('[HLS] Fatal error, cannot recover')
              this.onError?.(data.details)
              this.disconnect()
              break
          }
        }
      })
    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari) - append JWT to URL
      const urlWithToken = this.token
        ? `${this.url}${this.url.includes('?') ? '&' : '?'}jwt=${this.token}`
        : this.url
      this.videoElement.src = urlWithToken
      this.videoElement.addEventListener('loadedmetadata', () => {
        this.videoElement.play().catch(() => {})
      })
      this.videoElement.addEventListener('error', () => {
        this.onError?.('Native HLS playback failed')
      })
    } else {
      throw new Error('HLS is not supported in this browser')
    }
  }

  disconnect(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    this.videoElement.src = ''
  }
}
