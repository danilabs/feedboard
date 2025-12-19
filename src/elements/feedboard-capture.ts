import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { WhipClient, getDevices, captureCamera, captureScreen } from '@/lib/whip-client'

type CaptureSource = 'camera' | 'screen' | 'none'
type Status = 'idle' | 'previewing' | 'connecting' | 'live' | 'error'

@customElement('feedboard-capture')
export class FeedboardCapture extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #111;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }

    .preview-container {
      flex: 1;
      position: relative;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .no-preview {
      color: #444;
      font-size: 0.875rem;
      text-align: center;
    }

    .status-badge {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-badge.live {
      background: #dc2626;
      animation: pulse 1.5s infinite;
    }

    .status-badge.previewing {
      background: #2563eb;
    }

    .status-badge.connecting {
      background: #d97706;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .vu-meter {
      position: absolute;
      right: 0.5rem;
      top: 0.5rem;
      bottom: 0.5rem;
      width: 8px;
      background: #222;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column-reverse;
    }

    .vu-level {
      background: linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 80%, #dc2626 80%);
      transition: height 0.05s;
      width: 100%;
    }

    .controls {
      background: #1a1a1a;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border-top: 1px solid #333;
    }

    .control-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    select, input {
      flex: 1;
      padding: 0.4rem 0.5rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      font-size: 0.75rem;
      box-sizing: border-box;
    }

    select:focus, input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .btn {
      padding: 0.4rem 0.75rem;
      border: 1px solid #333;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .btn-source {
      background: #222;
      color: #fff;
    }

    .btn-source:hover {
      background: #333;
    }

    .btn-source.active {
      background: #2563eb;
      border-color: #3b82f6;
    }

    .btn-mute {
      background: #222;
      color: #888;
      min-width: 32px;
    }

    .btn-mute.muted {
      background: #7f1d1d;
      border-color: #dc2626;
      color: #fff;
    }

    .btn-publish {
      background: #15803d;
      border-color: #22c55e;
      color: #fff;
      flex: 1;
    }

    .btn-publish:hover {
      background: #16a34a;
    }

    .btn-publish.live {
      background: #dc2626;
      border-color: #ef4444;
    }

    .btn-publish:disabled {
      background: #333;
      border-color: #444;
      color: #666;
      cursor: not-allowed;
    }

    .btn-stop {
      background: #333;
      color: #fff;
    }

    .btn-stop:hover {
      background: #444;
    }

    .publish-row {
      display: flex;
      gap: 0.5rem;
    }

    .publish-path {
      flex: 1;
    }

    .error {
      color: #f87171;
      font-size: 0.7rem;
      padding: 0.25rem 0;
    }
  `

  @property({ type: String }) server = ''
  @property({ type: String, attribute: 'publish-path' }) publishPath = '/webcam'

  @state() private source: CaptureSource = 'none'
  @state() private status: Status = 'idle'
  @state() private cameras: MediaDeviceInfo[] = []
  @state() private microphones: MediaDeviceInfo[] = []
  @state() private selectedCamera = ''
  @state() private selectedMic = ''
  @state() private videoMuted = false
  @state() private audioMuted = false
  @state() private vuLevel = 0
  @state() private errorMessage = ''

  private stream: MediaStream | null = null
  private whipClient: WhipClient | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private vuInterval: number | null = null

  async connectedCallback() {
    super.connectedCallback()
    await this.loadDevices()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopCapture()
  }

  private async loadDevices() {
    try {
      const { cameras, microphones } = await getDevices()
      this.cameras = cameras
      this.microphones = microphones
      if (cameras.length) this.selectedCamera = cameras[0].deviceId
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
    this.source = 'camera'
    this.status = 'previewing'
    this.errorMessage = ''

    try {
      this.stream = await captureCamera({
        videoDeviceId: this.selectedCamera || undefined,
        audioDeviceId: this.selectedMic || undefined,
      })
      this.attachStream()
    } catch (e) {
      this.status = 'error'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to access camera'
    }
  }

  private async startScreen() {
    this.stopCapture()
    this.source = 'screen'
    this.status = 'previewing'
    this.errorMessage = ''

    try {
      this.stream = await captureScreen(true)
      // Screen share ended by user
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stopCapture()
      })
      this.attachStream()
    } catch (e) {
      this.status = 'error'
      this.errorMessage = e instanceof Error ? e.message : 'Failed to capture screen'
      this.source = 'none'
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

    this.source = 'none'
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
    if (!this.stream) return

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

  render() {
    const showVu = this.stream && !this.audioMuted && this.source !== 'none'

    return html`
      <div class="preview-container">
        <video muted playsinline></video>

        ${this.source === 'none'
          ? html`<div class="no-preview">Select a source to preview</div>`
          : ''}

        ${this.status === 'live'
          ? html`<div class="status-badge live">LIVE</div>`
          : this.status === 'connecting'
            ? html`<div class="status-badge connecting">Connecting</div>`
            : this.status === 'previewing'
              ? html`<div class="status-badge previewing">Preview</div>`
              : ''}

        ${showVu
          ? html`
              <div class="vu-meter">
                <div class="vu-level" style="height: ${this.vuLevel}%"></div>
              </div>
            `
          : ''}
      </div>

      <div class="controls">
        <div class="control-row">
          <button
            class="btn btn-source ${this.source === 'camera' ? 'active' : ''}"
            @click=${this.startCamera}
          >
            Camera
          </button>
          <button
            class="btn btn-source ${this.source === 'screen' ? 'active' : ''}"
            @click=${this.startScreen}
          >
            Screen
          </button>
          ${this.source !== 'none'
            ? html`
                <button class="btn btn-stop" @click=${this.stopCapture}>Stop</button>
              `
            : ''}
        </div>

        ${this.source === 'camera'
          ? html`
              <div class="control-row">
                <select
                  .value=${this.selectedCamera}
                  @change=${(e: Event) => {
                    this.selectedCamera = (e.target as HTMLSelectElement).value
                    if (this.status === 'previewing') this.startCamera()
                  }}
                >
                  ${this.cameras.map(
                    (c) => html`<option value=${c.deviceId}>${c.label || 'Camera'}</option>`
                  )}
                </select>
              </div>
              <div class="control-row">
                <select
                  .value=${this.selectedMic}
                  @change=${(e: Event) => {
                    this.selectedMic = (e.target as HTMLSelectElement).value
                    if (this.status === 'previewing') this.startCamera()
                  }}
                >
                  ${this.microphones.map(
                    (m) => html`<option value=${m.deviceId}>${m.label || 'Microphone'}</option>`
                  )}
                </select>
              </div>
            `
          : ''}

        <div class="control-row">
          <button
            class="btn btn-mute ${this.videoMuted ? 'muted' : ''}"
            @click=${this.toggleVideoMute}
            ?disabled=${!this.stream}
            title="Toggle video"
          >
            ${this.videoMuted ? '🚫' : '📹'}
          </button>
          <button
            class="btn btn-mute ${this.audioMuted ? 'muted' : ''}"
            @click=${this.toggleAudioMute}
            ?disabled=${!this.stream}
            title="Toggle audio"
          >
            ${this.audioMuted ? '🔇' : '🎤'}
          </button>
          <input
            class="publish-path"
            type="text"
            placeholder="/path"
            .value=${this.publishPath}
            @input=${(e: Event) => (this.publishPath = (e.target as HTMLInputElement).value)}
          />
          ${this.status === 'live'
            ? html`
                <button class="btn btn-publish live" @click=${this.stopPublishing}>
                  Stop
                </button>
              `
            : html`
                <button
                  class="btn btn-publish"
                  @click=${this.startPublishing}
                  ?disabled=${!this.stream || this.status === 'connecting'}
                >
                  ${this.status === 'connecting' ? 'Connecting...' : 'Publish'}
                </button>
              `}
        </div>

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-capture': FeedboardCapture
  }
}
