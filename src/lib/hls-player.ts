import Hls from 'hls.js'

export class HlsPlayer {
  private hls: Hls | null = null
  public onError: ((error: string) => void) | null = null
  public usingNative = false

  constructor(
    private url: string,
    private videoElement: HTMLVideoElement
  ) {}

  connect(): void {
    // Prefer hls.js for cookie-based auth (native HLS doesn't send cookies reliably)
    if (Hls.isSupported()) {
      const config: Partial<Hls['config']> = {
        enableWorker: true,
        lowLatencyMode: true,
        // Send cookies for authentication
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = true
        },
      }

      this.hls = new Hls(config)

      this.hls.loadSource(this.url)
      this.hls.attachMedia(this.videoElement)

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
      // Fallback to native HLS (Safari without MSE)
      this.usingNative = true
      this.videoElement.src = this.url
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
