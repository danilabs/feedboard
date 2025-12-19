import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { WhipClient, getDevices, captureCamera, captureScreen } from '@/lib/whip-client'

type CaptureType = 'camera' | 'screen' | 'tab'
type Status = 'idle' | 'previewing' | 'connecting' | 'live' | 'error'

@customElement('feedboard-capture')
export class FeedboardCapture extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
    }

    .status-dot.previewing {
      background: #2563eb;
    }

    .status-dot.live {
      background: #dc2626;
      animation: pulse 1.5s infinite;
    }

    .status-dot.connecting {
      background: #d97706;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Info overlay - matches player style */
    .info-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 0.7rem;
      padding: 0.5rem 0.6rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      z-index: 20;
    }

    .info-title-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
      font-size: 0.75rem;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .info-label {
      color: #888;
      min-width: 50px;
    }

    .info-select {
      padding: 0.15rem 0.3rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #fff;
      font-size: 0.65rem;
      cursor: pointer;
    }

    .info-select:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
    }

    .info-input {
      flex: 1;
      padding: 0.15rem 0.3rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #fff;
      font-size: 0.65rem;
    }

    .info-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
    }

    .info-controls {
      display: flex;
      gap: 0.3rem;
      margin-top: 0.2rem;
    }

    .info-btn {
      padding: 0.2rem 0.4rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #fff;
      font-size: 0.6rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .info-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .info-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
    }

    .info-btn.publish {
      background: #15803d;
      border-color: #22c55e;
    }

    .info-btn.publish:hover {
      background: #16a34a;
    }

    .info-btn.publish.live {
      background: #dc2626;
      border-color: #ef4444;
    }

    .info-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .vu-meter {
      position: absolute;
      right: 0.5rem;
      top: 0.5rem;
      bottom: 4rem;
      width: 6px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 3px;
      overflow: hidden;
      display: flex;
      flex-direction: column-reverse;
    }

    .vu-level {
      background: linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 80%, #dc2626 80%);
      transition: height 0.05s;
      width: 100%;
    }

    .error-text {
      color: #f87171;
      font-size: 0.6rem;
    }
  `

  // Configuration attributes
  @property({ type: String }) type: CaptureType = 'camera'
  @property({ type: String, attribute: 'publish-to' }) publishTo = ''
  @property({ type: String }) server = ''
  @property({ type: String, attribute: 'device-id' }) deviceId = ''
  @property({ type: String }) resolution: '720p' | '1080p' | '4k' = '1080p'
  @property({ type: Boolean, attribute: 'show-info' }) showInfo = false

  // Internal state
  @state() private currentType: CaptureType = 'camera'
  @state() private status: Status = 'idle'
  @state() private cameras: MediaDeviceInfo[] = []
  @state() private microphones: MediaDeviceInfo[] = []
  @state() private selectedCamera = ''
  @state() private selectedMic = ''
  @state() private videoMuted = false
  @state() private audioMuted = false
  @state() private vuLevel = 0
  @state() private errorMessage = ''
  @state() private publishPath = ''

  private stream: MediaStream | null = null
  private whipClient: WhipClient | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private vuInterval: number | null = null

  async connectedCallback() {
    super.connectedCallback()
    this.currentType = this.type
    this.publishPath = this.publishTo
    await this.loadDevices()

    // Auto-start camera by default
    if (this.type === 'camera') {
      this.startCamera()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopCapture()
  }

  private getResolutionConstraints() {
    switch (this.resolution) {
      case '720p': return { width: 1280, height: 720 }
      case '4k': return { width: 3840, height: 2160 }
      default: return { width: 1920, height: 1080 }
    }
  }

  private async loadDevices() {
    try {
      const { cameras, microphones } = await getDevices()
      this.cameras = cameras
      this.microphones = microphones
      if (this.deviceId) {
        this.selectedCamera = this.deviceId
      } else if (cameras.length) {
        this.selectedCamera = cameras[0].deviceId
      }
      if (microphones.length) this.selectedMic = microphones[0].deviceId
    } catch (e) {
      console.warn('Could not enumerate devices:', e)
    }
  }

  private getServerUrl(): string {
    if (this.server) return this.server
    return window.location.origin.replace(/:\d+$/, ':8889')
  }

  private async startCamera() {
    this.stopCapture()
    this.currentType = 'camera'
    this.status = 'previewing'
    this.errorMessage = ''

    try {
      this.stream = await captureCamera({
        videoDeviceId: this.selectedCamera || undefined,
        audioDeviceId: this.selectedMic || undefined,
        ...this.getResolutionConstraints(),
      })
      this.attachStream()
    } catch (e) {
      this.status = 'error'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to access camera'
    }
  }

  private async startScreen() {
    this.stopCapture()
    this.currentType = 'screen'
    this.status = 'previewing'
    this.errorMessage = ''

    try {
      this.stream = await captureScreen(true)
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stopCapture()
      })
      this.attachStream()
    } catch (e) {
      this.status = 'error'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to capture screen'
      this.currentType = 'camera'
    }
  }

  private async startTab() {
    this.stopCapture()
    this.currentType = 'tab'
    this.status = 'previewing'
    this.errorMessage = ''

    try {
      // @ts-ignore - preferCurrentTab is experimental
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
        // @ts-ignore
        preferCurrentTab: false,
        selfBrowserSurface: 'include',
      })
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stopCapture()
      })
      this.attachStream()
    } catch (e) {
      this.status = 'error'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to capture tab'
      this.currentType = 'camera'
    }
  }

  private attachStream() {
    const video = this.shadowRoot?.querySelector('video')
    if (video && this.stream) {
      video.srcObject = this.stream
      video.play()
      this.startVuMeter()
    }
  }

  private startVuMeter() {
    if (!this.stream) return

    const audioTracks = this.stream.getAudioTracks()
    if (!audioTracks.length) return

    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    this.vuInterval = window.setInterval(() => {
      if (!this.analyser) return
      this.analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      this.vuLevel = Math.min(100, (avg / 128) * 100)
    }, 50)
  }

  private stopVuMeter() {
    if (this.vuInterval) {
      clearInterval(this.vuInterval)
      this.vuInterval = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    this.vuLevel = 0
  }

  private stopCapture() {
    this.stopVuMeter()
    this.stopPublishing()

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }

    const video = this.shadowRoot?.querySelector('video')
    if (video) {
      video.srcObject = null
    }

    this.status = 'idle'
  }

  private toggleVideoMute() {
    this.videoMuted = !this.videoMuted
    this.stream?.getVideoTracks().forEach((t) => (t.enabled = !this.videoMuted))
  }

  private toggleAudioMute() {
    this.audioMuted = !this.audioMuted
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.audioMuted))
  }

  private async startPublishing() {
    if (!this.stream || !this.publishPath) return

    this.status = 'connecting'
    this.errorMessage = ''

    const path = this.publishPath.startsWith('/') ? this.publishPath.slice(1) : this.publishPath
    const url = `${this.getServerUrl()}/${path}/whip`

    try {
      this.whipClient = new WhipClient(url)
      await this.whipClient.publish(this.stream)
      this.status = 'live'
    } catch (e) {
      this.status = 'previewing'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to publish'
    }
  }

  private stopPublishing() {
    if (this.whipClient) {
      this.whipClient.disconnect()
      this.whipClient = null
    }
    if (this.status === 'live') {
      this.status = this.stream ? 'previewing' : 'idle'
    }
  }

  private handleSourceChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as CaptureType
    if (value === 'camera') this.startCamera()
    else if (value === 'screen') this.startScreen()
    else if (value === 'tab') this.startTab()
  }

  private handleCameraChange(e: Event) {
    this.selectedCamera = (e.target as HTMLSelectElement).value
    if (this.status === 'previewing' && this.currentType === 'camera') {
      this.startCamera()
    }
  }

  private handleMicChange(e: Event) {
    this.selectedMic = (e.target as HTMLSelectElement).value
    if (this.status === 'previewing' && this.currentType === 'camera') {
      this.startCamera()
    }
  }

  render() {
    const showVu = this.stream && !this.audioMuted && this.showInfo

    return html`
      <video muted playsinline></video>

      ${showVu ? html`
        <div class="vu-meter">
          <div class="vu-level" style="height: ${this.vuLevel}%"></div>
        </div>
      ` : ''}

      ${this.showInfo ? html`
        <div class="info-overlay">
          <div class="info-title-row">
            <div class="status-dot ${this.status}"></div>
            <span>Capture</span>
          </div>

          <div class="info-row">
            <span class="info-label">Source</span>
            <select
              class="info-select"
              .value=${this.currentType}
              @change=${this.handleSourceChange}
            >
              <option value="camera">Camera</option>
              <option value="screen">Screen</option>
              <option value="tab">Tab</option>
            </select>
          </div>

          ${this.currentType === 'camera' && this.cameras.length > 0 ? html`
            <div class="info-row">
              <span class="info-label">Camera</span>
              <select
                class="info-select"
                .value=${this.selectedCamera}
                @change=${this.handleCameraChange}
              >
                ${this.cameras.map(c => html`
                  <option value=${c.deviceId}>${c.label || 'Camera'}</option>
                `)}
              </select>
            </div>
            <div class="info-row">
              <span class="info-label">Mic</span>
              <select
                class="info-select"
                .value=${this.selectedMic}
                @change=${this.handleMicChange}
              >
                ${this.microphones.map(m => html`
                  <option value=${m.deviceId}>${m.label || 'Microphone'}</option>
                `)}
              </select>
            </div>
          ` : ''}

          <div class="info-row">
            <span class="info-label">Publish</span>
            <input
              class="info-input"
              type="text"
              placeholder="/path"
              .value=${this.publishPath}
              @input=${(e: Event) => this.publishPath = (e.target as HTMLInputElement).value}
            />
          </div>

          <div class="info-controls">
            <button
              class="info-btn ${!this.videoMuted ? 'active' : ''}"
              @click=${this.toggleVideoMute}
              ?disabled=${!this.stream}
            >${this.videoMuted ? 'Video Off' : 'Video On'}</button>
            <button
              class="info-btn ${!this.audioMuted ? 'active' : ''}"
              @click=${this.toggleAudioMute}
              ?disabled=${!this.stream}
            >${this.audioMuted ? 'Audio Off' : 'Audio On'}</button>
            ${this.status === 'live' ? html`
              <button class="info-btn publish live" @click=${this.stopPublishing}>
                Stop
              </button>
            ` : html`
              <button
                class="info-btn publish"
                @click=${this.startPublishing}
                ?disabled=${!this.stream || this.status === 'connecting' || !this.publishPath}
              >
                ${this.status === 'connecting' ? '...' : 'Publish'}
              </button>
            `}
            <button class="info-btn" @click=${this.stopCapture} ?disabled=${this.status === 'idle'}>
              Stop
            </button>
          </div>

          ${this.errorMessage ? html`<div class="error-text">${this.errorMessage}</div>` : ''}
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-capture': FeedboardCapture
  }
}
