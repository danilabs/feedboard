import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { WhipClient, getDevices, captureCamera, captureScreen } from '@/lib/whip-client'
import { PPMMeter, dbfsToPercent, type PPMMeterData } from '@/lib/ppm-meter'
import { icons } from '@/lib/icons'

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

    video.mirrored {
      transform: scaleX(-1);
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

    .info-btn svg {
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
    }

    /* PPM Meter */
    .ppm-meter {
      position: absolute;
      right: 0.5rem;
      top: 0.5rem;
      bottom: 4rem;
      width: 8px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column-reverse;
      z-index: 15;
    }

    .ppm-meter.stereo {
      width: 18px;
      display: flex;
      flex-direction: row;
      gap: 2px;
      padding: 2px;
    }

    .ppm-channel {
      flex: 1;
      display: flex;
      flex-direction: column-reverse;
      position: relative;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      overflow: hidden;
    }

    .ppm-level {
      background: linear-gradient(to top,
        #22c55e 0%,
        #22c55e 70%,
        #eab308 70%,
        #eab308 90%,
        #dc2626 90%
      );
      transition: height 0.02s linear;
      width: 100%;
    }

    .ppm-peak {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: #fff;
      transition: bottom 0.02s linear;
    }

    .error-text {
      color: #f87171;
      font-size: 0.6rem;
    }

    /* Label overlay - centered white text over blur */
    .label-overlay {
      position: absolute;
      left: 50%;
      bottom: 0.75rem;
      transform: translateX(-50%);
      padding: 0.25rem 0.75rem;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      border-radius: 4px;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      z-index: 15;
    }
  `

  // Configuration attributes
  @property({ type: String }) type: CaptureType = 'camera'
  @property({ type: String, attribute: 'publish-to' }) publishTo = ''
  @property({ type: String }) server = ''
  @property({ type: String, attribute: 'device-id' }) deviceId = ''
  @property({ type: String }) resolution: '720p' | '1080p' | '4k' = '1080p'
  @property({ type: Boolean, attribute: 'show-info' }) showInfo = false
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false
  @property({ type: Boolean, attribute: 'show-vu' }) showVu = false

  // Internal state
  @state() private currentType: CaptureType = 'camera'
  @state() private status: Status = 'idle'
  @state() private cameras: MediaDeviceInfo[] = []
  @state() private microphones: MediaDeviceInfo[] = []
  @state() private selectedCamera = ''
  @state() private selectedMic = ''
  @state() private videoMuted = false
  @state() private audioMuted = false
  @state() private meterData: PPMMeterData | null = null
  @state() private errorMessage = ''
  @state() private publishPath = ''

  // Capture settings
  @state() private currentResolution: '720p' | '1080p' | '4k' = '1080p'
  @state() private frameRate: 24 | 30 | 60 = 30
  @state() private mirrored = false
  @state() private echoCancellation = false
  @state() private noiseSuppression = false
  @state() private autoGainControl = false

  private stream: MediaStream | null = null
  private whipClient: WhipClient | null = null
  private ppmMeter: PPMMeter | null = null

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

  private getVideoConstraints() {
    let width: number, height: number
    switch (this.currentResolution) {
      case '720p': width = 1280; height = 720; break
      case '4k': width = 3840; height = 2160; break
      default: width = 1920; height = 1080
    }
    return {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: this.frameRate }
    }
  }

  private getAudioConstraints() {
    return {
      echoCancellation: this.echoCancellation,
      noiseSuppression: this.noiseSuppression,
      autoGainControl: this.autoGainControl
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
      const videoConstraints = this.getVideoConstraints()
      this.stream = await captureCamera({
        videoDeviceId: this.selectedCamera || undefined,
        audioDeviceId: this.selectedMic || undefined,
        width: videoConstraints.width?.ideal as number,
        height: videoConstraints.height?.ideal as number,
        frameRate: videoConstraints.frameRate?.ideal as number,
        echoCancellation: this.echoCancellation,
        noiseSuppression: this.noiseSuppression,
        autoGainControl: this.autoGainControl,
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
      this.startPPMMeter()
    }
  }

  private async startPPMMeter() {
    if (!this.stream || this.ppmMeter) return

    const audioTracks = this.stream.getAudioTracks()
    if (!audioTracks.length) return

    try {
      this.ppmMeter = new PPMMeter({
        onData: (data) => {
          this.meterData = data
        }
      })
      await this.ppmMeter.connect(this.stream)
    } catch (e) {
      console.warn('Could not start PPM meter:', e)
    }
  }

  private stopPPMMeter() {
    if (this.ppmMeter) {
      this.ppmMeter.disconnect()
      this.ppmMeter = null
    }
    this.meterData = null
  }

  private stopCapture() {
    this.stopPPMMeter()
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

  private getDisplayLabel(): string {
    // For capture, derive label from publish path or type
    if (this.publishPath) {
      let path = this.publishPath
      if (path.startsWith('/')) path = path.slice(1)
      return path
    }
    return this.currentType.toUpperCase()
  }

  render() {
    const showPPMMeter = this.stream && !this.audioMuted && this.meterData && (this.showVu || this.showInfo)
    const showMirror = this.mirrored && this.currentType === 'camera'

    return html`
      <video class="${showMirror ? 'mirrored' : ''}" muted playsinline></video>

      ${this.showLabel && this.stream ? html`
        <div class="label-overlay">${this.getDisplayLabel()}</div>
      ` : ''}

      ${showPPMMeter ? html`
        <div class="ppm-meter ${this.meterData!.channels > 1 ? 'stereo' : ''}">
          ${this.meterData!.channels > 1 ? html`
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData!.level[0])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData!.peak[0])}%"></div>
            </div>
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData!.level[1])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData!.peak[1])}%"></div>
            </div>
          ` : html`
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData!.level[0])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData!.peak[0])}%"></div>
            </div>
          `}
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
            <div class="info-row">
              <span class="info-label">Quality</span>
              <select
                class="info-select"
                .value=${this.currentResolution}
                @change=${(e: Event) => {
                  this.currentResolution = (e.target as HTMLSelectElement).value as '720p' | '1080p' | '4k'
                  if (this.stream) this.startCamera()
                }}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
              <select
                class="info-select"
                .value=${String(this.frameRate)}
                @change=${(e: Event) => {
                  this.frameRate = parseInt((e.target as HTMLSelectElement).value) as 24 | 30 | 60
                  if (this.stream) this.startCamera()
                }}
              >
                <option value="24">24fps</option>
                <option value="30">30fps</option>
                <option value="60">60fps</option>
              </select>
            </div>
            <div class="info-row">
              <button
                class="info-btn ${this.mirrored ? 'active' : ''}"
                @click=${() => this.mirrored = !this.mirrored}
                title="Mirror video"
              >Mirror</button>
              <button
                class="info-btn ${this.echoCancellation ? 'active' : ''}"
                @click=${() => { this.echoCancellation = !this.echoCancellation; if (this.stream) this.startCamera() }}
                title="Echo cancellation"
              >Echo</button>
              <button
                class="info-btn ${this.noiseSuppression ? 'active' : ''}"
                @click=${() => { this.noiseSuppression = !this.noiseSuppression; if (this.stream) this.startCamera() }}
                title="Noise suppression"
              >Noise</button>
              <button
                class="info-btn ${this.autoGainControl ? 'active' : ''}"
                @click=${() => { this.autoGainControl = !this.autoGainControl; if (this.stream) this.startCamera() }}
                title="Auto gain control"
              >AGC</button>
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
            >${this.videoMuted ? icons.videoOff : icons.video} ${this.videoMuted ? 'Off' : 'On'}</button>
            <button
              class="info-btn ${!this.audioMuted ? 'active' : ''}"
              @click=${this.toggleAudioMute}
              ?disabled=${!this.stream}
            >${this.audioMuted ? icons.micOff : icons.mic} ${this.audioMuted ? 'Off' : 'On'}</button>
            ${this.status === 'live' ? html`
              <button class="info-btn publish live" @click=${this.stopPublishing}>
                ${icons.stop} Stop
              </button>
            ` : html`
              <button
                class="info-btn publish"
                @click=${this.startPublishing}
                ?disabled=${!this.stream || this.status === 'connecting' || !this.publishPath}
              >
                ${this.status === 'connecting' ? '...' : html`${icons.radio} Publish`}
              </button>
            `}
            <button class="info-btn" @click=${this.stopCapture} ?disabled=${this.status === 'idle'}>
              ${icons.stop} Stop
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
