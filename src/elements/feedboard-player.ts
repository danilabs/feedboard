import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { WhepClient } from '@/lib/whep-client'
import { HlsPlayer } from '@/lib/hls-player'
import { PPMMeter, dbfsToPercent, type PPMMeterData } from '@/lib/ppm-meter'
import { icons } from '@/lib/icons'

type Protocol = 'auto' | 'whep' | 'hls'
type FitMode = 'contain' | 'cover' | 'fill'
type Status = 'idle' | 'connecting' | 'playing' | 'error'

@customElement('feedboard-player')
export class FeedboardPlayer extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: var(--feedboard-aspect, 16/9);
      background: #000;
      overflow: hidden;
    }

    :host([fill]) {
      aspect-ratio: unset;
      height: 100%;
    }

    video {
      width: 100%;
      height: 100%;
    }

    video[data-fit='contain'] {
      object-fit: contain;
    }

    video[data-fit='cover'] {
      object-fit: cover;
    }

    video[data-fit='fill'] {
      object-fit: fill;
    }

    .slate {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      gap: 1rem;
      container-type: size;
    }

    .slate.hidden {
      display: none;
    }

    .slate-text {
      font-size: clamp(1rem, 6cqw, 3rem);
      font-weight: 700;
    }

    .slate-subtext {
      font-size: clamp(0.6rem, 2cqw, 1rem);
      opacity: 0.6;
    }

    .spinner {
      width: clamp(24px, 8cqw, 48px);
      height: clamp(24px, 8cqw, 48px);
      border: 3px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      opacity: 0.5;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @supports not (font-size: 1cqw) {
      .slate-text { font-size: clamp(1rem, 4vmin, 2.5rem); }
      .slate-subtext { font-size: clamp(0.6rem, 1.5vmin, 0.875rem); }
      .spinner { width: 32px; height: 32px; }
    }

    /* Controls bar */
    .controls {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.5rem;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.7rem;
      color: #fff;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    }

    :host(:hover) .controls,
    :host([controls-visible]) .controls {
      opacity: 1;
    }

    .controls.always-visible {
      opacity: 1;
    }

    .ctrl-btn {
      padding: 0.25rem 0.5rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #ccc;
      cursor: pointer;
      font-size: 0.65rem;
      transition: all 0.15s;
    }

    .ctrl-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .ctrl-btn.active {
      background: rgba(220, 38, 38, 0.8);
      border-color: #dc2626;
      color: #fff;
    }

    .ctrl-select {
      padding: 0.2rem 0.35rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #ccc;
      font-size: 0.65rem;
      cursor: pointer;
    }

    .ctrl-select:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .ctrl-status {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-left: auto;
      color: #888;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #666;
    }

    .status-dot.playing {
      background: #22c55e;
    }

    .status-dot.connecting {
      background: #eab308;
      animation: blink 1s infinite;
    }

    .status-dot.error {
      background: #dc2626;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Info overlay */
    .info-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
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
      border-color: #3b82f6;
    }

    .info-value {
      color: #aaa;
    }

    .info-controls {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.15rem;
    }

    .info-btn {
      padding: 0.2rem 0.5rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #ccc;
      font-size: 0.65rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .info-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .info-btn.active {
      background: rgba(220, 38, 38, 0.8);
      border-color: #dc2626;
      color: #fff;
    }

    .info-btn svg {
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
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

    /* PPM Meter */
    .ppm-meter {
      position: absolute;
      right: 0.5rem;
      top: 0.5rem;
      bottom: 0.5rem;
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
        #22c55e 70%,      /* Green: -60 to -18 dBFS */
        #eab308 70%,
        #eab308 90%,      /* Yellow: -18 to -6 dBFS */
        #dc2626 90%       /* Red: -6 to 0 dBFS */
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

    /* dBFS scale markers (optional, shown on hover) */
    .ppm-meter:hover::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 10%;
      height: 1px;
      background: rgba(255, 255, 255, 0.3);
    }

    .ppm-meter:hover::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 30%;
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
    }

    /* Click to play overlay */
    .click-to-play {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      cursor: pointer;
      z-index: 25;
    }

    .play-button {
      width: 64px;
      height: 64px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, background 0.15s;
    }

    .play-button:hover {
      transform: scale(1.1);
      background: #fff;
    }

    .play-button::after {
      content: '';
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 12px 0 12px 20px;
      border-color: transparent transparent transparent #000;
      margin-left: 4px;
    }

    /* Play button inside slate */
    .play-button-slate {
      width: clamp(48px, 12cqw, 80px);
      height: clamp(48px, 12cqw, 80px);
      background: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s, background 0.15s, border-color 0.15s;
    }

    .play-button-slate:hover {
      transform: scale(1.1);
      background: rgba(255, 255, 255, 0.25);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .play-button-slate::after {
      content: '';
      width: 0;
      height: 0;
      border-style: solid;
      border-width: clamp(8px, 2cqw, 14px) 0 clamp(8px, 2cqw, 14px) clamp(14px, 3.5cqw, 24px);
      border-color: transparent transparent transparent currentColor;
      margin-left: clamp(3px, 0.8cqw, 6px);
    }

  `

  @property({ type: String }) src = ''
  @property({ type: String }) server = ''
  @property({ type: String }) protocol: Protocol = 'auto'
  @property({ type: String }) fit: FitMode = 'contain'
  @property({ type: Boolean }) muted = false
  @property({ type: Boolean }) autoplay = true
  @property({ type: Boolean }) controls = false

  // Slate properties for loading/error states
  @property({ type: String, attribute: 'slate-text' }) slateText = 'STANDBY'
  @property({ type: String, attribute: 'slate-background' }) slateBackground = '#1a1a1a'
  @property({ type: String, attribute: 'slate-color' }) slateColor = '#888'
  @property({ type: String, attribute: 'error-text' }) errorText = 'NO SIGNAL'
  @property({ type: String, attribute: 'error-background' }) errorBackground = '#1a1a1a'
  @property({ type: String, attribute: 'error-color' }) errorColor = '#cc0000'

  @state() status: Status = 'idle'
  @state() private errorMessage = ''
  @state() private needsClick = false
  @state() activeProtocol: 'whep' | 'hls' | null = null
  @property({ type: Boolean, attribute: 'show-info' }) showInfo = false

  // Label properties
  @property({ type: String }) label = ''
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false

  // PPM meter properties
  @property({ type: Boolean, attribute: 'show-vu' }) showVu = false
  @state() private meterData: PPMMeterData | null = null

  // Stream stats
  @state() private streamStats: {
    resolution?: string
    framerate?: number
    bitrate?: number
    codec?: string
    packetsLost?: number
  } = {}

  private whepClient: WhepClient | null = null
  private hlsPlayer: HlsPlayer | null = null
  private videoElement: HTMLVideoElement | null = null
  private ppmMeter: PPMMeter | null = null
  private hasConnected = false
  private statsInterval: number | null = null
  private lastBytesReceived = 0
  private lastStatsTime = 0

  connectedCallback() {
    super.connectedCallback()
    if (this.src && this.autoplay) {
      this.updateComplete.then(() => this.connect())
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.disconnect()
    this.stopPPMMeter()
    this.stopStatsPolling()
  }

  private getDisplayLabel(): string {
    if (this.label) return this.label
    // Derive from src path - remove leading slash and /whep suffix
    if (this.src) {
      let path = this.src
      if (path.startsWith('/')) path = path.slice(1)
      if (path.endsWith('/whep')) path = path.slice(0, -5)
      return path
    }
    return ''
  }

  private async startPPMMeter() {
    if (this.ppmMeter) return

    try {
      const srcObject = this.videoElement?.srcObject as MediaStream | null
      if (!srcObject) return

      const audioTracks = srcObject.getAudioTracks()
      if (!audioTracks.length) return

      this.ppmMeter = new PPMMeter({
        onData: (data) => {
          this.meterData = data
        }
      })

      await this.ppmMeter.connect(srcObject)
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

  private startStatsPolling() {
    if (this.statsInterval) return
    this.statsInterval = window.setInterval(() => this.updateStats(), 1000)
    this.updateStats()
  }

  private stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
    this.streamStats = {}
  }

  private async updateStats() {
    if (!this.whepClient) return

    try {
      const stats = await this.whepClient.getStats()
      if (!stats) return

      const now = Date.now()
      let totalBytesReceived = 0

      stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          this.streamStats = {
            ...this.streamStats,
            resolution: report.frameWidth && report.frameHeight
              ? `${report.frameWidth}×${report.frameHeight}`
              : this.streamStats.resolution,
            framerate: report.framesPerSecond
              ? Math.round(report.framesPerSecond)
              : this.streamStats.framerate,
            packetsLost: report.packetsLost,
          }
          totalBytesReceived += report.bytesReceived || 0
        }

        if (report.type === 'codec' && report.mimeType?.startsWith('video/')) {
          this.streamStats = {
            ...this.streamStats,
            codec: report.mimeType.replace('video/', '').toUpperCase(),
          }
        }
      })

      // Calculate bitrate
      if (this.lastStatsTime > 0 && totalBytesReceived > this.lastBytesReceived) {
        const elapsed = (now - this.lastStatsTime) / 1000
        const bytes = totalBytesReceived - this.lastBytesReceived
        const bitrate = Math.round((bytes * 8) / elapsed / 1000) // kbps
        this.streamStats = { ...this.streamStats, bitrate }
      }

      this.lastBytesReceived = totalBytesReceived
      this.lastStatsTime = now
    } catch (e) {
      // Stats not available
    }
  }

  private getServer(): string {
    // Look for server from parent elements or use attribute
    if (this.server) return this.server

    // Walk up the DOM to find a server attribute
    let parent = this.parentElement
    while (parent) {
      const serverAttr = parent.getAttribute('server')
      if (serverAttr) return serverAttr
      parent = parent.parentElement
    }

    // Default to current origin
    return window.location.origin.replace(':3000', ':8889')
  }

  private resolveUrl(): { whepUrl?: string; hlsUrl?: string } {
    const src = this.src

    // Full URL provided
    if (src.startsWith('http://') || src.startsWith('https://')) {
      if (src.includes('.m3u8') || src.includes('/hls/')) {
        return { hlsUrl: src }
      }
      return { whepUrl: src }
    }

    // Path-based - construct full URLs
    const server = this.getServer()
    const cleanPath = src.startsWith('/') ? src.slice(1) : src

    return {
      whepUrl: `${server}/${cleanPath}/whep`,
      hlsUrl: `${server.replace(':8889', ':8888')}/${cleanPath}/index.m3u8`,
    }
  }

  async connect() {
    this.disconnect()
    this.status = 'connecting'
    this.errorMessage = ''

    const urls = this.resolveUrl()
    const useProtocol =
      this.protocol === 'auto'
        ? urls.whepUrl
          ? 'whep'
          : 'hls'
        : this.protocol

    try {
      this.videoElement = this.shadowRoot?.querySelector('video') || null
      if (!this.videoElement) {
        await this.updateComplete
        this.videoElement = this.shadowRoot?.querySelector('video') || null
      }

      if (!this.videoElement) {
        throw new Error('Video element not found')
      }

      if (useProtocol === 'whep' && urls.whepUrl) {
        this.whepClient = new WhepClient(urls.whepUrl)
        const stream = await this.whepClient.connect()
        this.videoElement.srcObject = stream
        try {
          await this.videoElement.play()
        } catch (playError) {
          // Autoplay blocked - need user interaction
          if (playError instanceof Error && playError.name === 'NotAllowedError') {
            this.needsClick = true
            this.status = 'playing' // Stream is connected, just paused
            this.hasConnected = true
            this.activeProtocol = 'whep'
            return
          }
          throw playError
        }
        this.activeProtocol = 'whep'
        // Start PPM meter for WHEP streams (has audio track access)
        if (this.showVu) {
          this.startPPMMeter()
        }
        // Start stats polling if info panel is shown
        if (this.showInfo) {
          this.startStatsPolling()
        }
      } else if (urls.hlsUrl) {
        this.hlsPlayer = new HlsPlayer(urls.hlsUrl, this.videoElement)
        this.hlsPlayer.connect()
        this.activeProtocol = 'hls'
      } else {
        throw new Error('No valid URL for playback')
      }

      this.status = 'playing'
      this.hasConnected = true
      this.needsClick = false
      this.dispatchEvent(new CustomEvent('playing'))
    } catch (error) {
      this.status = 'error'
      this.errorMessage = error instanceof Error ? error.message : 'Connection failed'
      this.dispatchEvent(new CustomEvent('error', { detail: error }))

      // Auto-retry with HLS if WHEP fails
      if (useProtocol === 'whep' && this.protocol === 'auto' && urls.hlsUrl) {
        console.log('WHEP failed, trying HLS fallback...')
        setTimeout(() => this.connectHls(urls.hlsUrl!), 1000)
      }
    }
  }

  private async connectHls(url: string) {
    try {
      this.status = 'connecting'
      this.videoElement = this.shadowRoot?.querySelector('video') || null
      if (!this.videoElement) return

      this.hlsPlayer = new HlsPlayer(url, this.videoElement)
      this.hlsPlayer.connect()
      this.status = 'playing'
    } catch (error) {
      this.status = 'error'
      this.errorMessage = 'HLS fallback failed'
    }
  }

  disconnect() {
    this.stopPPMMeter()
    if (this.whepClient) {
      this.whepClient.disconnect()
      this.whepClient = null
    }
    if (this.hlsPlayer) {
      this.hlsPlayer.disconnect()
      this.hlsPlayer = null
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null
      this.videoElement.src = ''
    }
    this.status = 'idle'
    this.activeProtocol = null
  }

  updated(changedProperties: Map<string, unknown>) {
    // Start/stop PPM meter when showVu changes
    if (changedProperties.has('showVu')) {
      if (this.showVu && this.status === 'playing' && this.activeProtocol === 'whep') {
        this.startPPMMeter()
      } else if (!this.showVu) {
        this.stopPPMMeter()
      }
    }

    // Start/stop stats polling when showInfo changes
    if (changedProperties.has('showInfo')) {
      if (this.showInfo && this.status === 'playing' && this.activeProtocol === 'whep') {
        this.startStatsPolling()
      } else if (!this.showInfo) {
        this.stopStatsPolling()
      }
    }

    // Reconnect if src changed after we've already connected once
    if (changedProperties.has('src') && this.hasConnected && this.src) {
      this.connect()
    }
  }

  private toggleMute() {
    this.muted = !this.muted
    if (this.videoElement) {
      this.videoElement.muted = this.muted
    }
  }

  private async handlePlayClick() {
    if (this.videoElement) {
      try {
        await this.videoElement.play()
        this.needsClick = false
        if (this.showVu && this.activeProtocol === 'whep') {
          this.startPPMMeter()
        }
        // Notify parent that user has interacted - other players can retry
        this.dispatchEvent(new CustomEvent('user-gesture', { bubbles: true, composed: true }))
      } catch (e) {
        console.warn('Play failed:', e)
      }
    }
  }

  /** Public method - retry playback after user gesture elsewhere */
  async retryPlay(): Promise<void> {
    if (this.needsClick && this.videoElement) {
      try {
        await this.videoElement.play()
        this.needsClick = false
        if (this.showVu && this.activeProtocol === 'whep') {
          this.startPPMMeter()
        }
      } catch (e) {
        // Still needs direct interaction
      }
    }
  }

  private handleProtocolChange(e: Event) {
    const select = e.target as HTMLSelectElement
    this.protocol = select.value as Protocol
    this.disconnect()
    this.connect()
  }

  private reconnect() {
    this.disconnect()
    this.connect()
  }

  render() {
    const isError = this.status === 'error'
    // Show slate when not playing, OR when waiting for click interaction
    const showSlate = this.status !== 'playing' || this.needsClick

    const bg = isError ? this.errorBackground : this.slateBackground
    const color = isError ? this.errorColor : this.slateColor

    return html`
      <video data-fit=${this.fit} ?muted=${this.muted} playsinline></video>
      <div
        class="slate ${showSlate ? '' : 'hidden'}"
        style="background: ${bg}; color: ${color};"
      >
        ${this.status === 'connecting' ? html`<div class="spinner"></div>` : ''}
        ${this.needsClick ? html`
          <div class="play-button-slate" @click=${this.handlePlayClick}></div>
        ` : ''}
        <div class="slate-text">${this.src || 'No source'}</div>
        ${this.status === 'connecting'
          ? html`<div class="slate-subtext">Connecting...</div>`
          : this.status === 'error'
            ? html`<div class="slate-subtext">${this.errorMessage}</div>`
            : this.status === 'idle'
              ? html`<div class="slate-subtext">Waiting</div>`
              : this.needsClick
                ? html`<div class="slate-subtext">Click to play</div>`
                : ''}
      </div>
      ${this.showLabel && this.status === 'playing' && !this.needsClick ? html`
        <div class="label-overlay">${this.getDisplayLabel()}</div>
      ` : ''}
      ${this.showVu && this.meterData ? html`
        <div class="ppm-meter ${this.meterData.channels > 1 ? 'stereo' : ''}">
          ${this.meterData.channels > 1 ? html`
            <!-- Stereo: Left channel -->
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData.level[0])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData.peak[0])}%"></div>
            </div>
            <!-- Stereo: Right channel -->
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData.level[1])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData.peak[1])}%"></div>
            </div>
          ` : html`
            <!-- Mono -->
            <div class="ppm-channel">
              <div class="ppm-level" style="height: ${dbfsToPercent(this.meterData.level[0])}%"></div>
              <div class="ppm-peak" style="bottom: ${dbfsToPercent(this.meterData.peak[0])}%"></div>
            </div>
          `}
        </div>
      ` : ''}
      ${this.showInfo ? html`
        <div class="info-overlay">
          <div class="info-title-row">
            <div class="status-dot ${this.status}"></div>
            <span>${this.src || 'No source'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Protocol</span>
            <select
              class="info-select"
              .value=${this.protocol}
              @change=${this.handleProtocolChange}
            >
              <option value="auto">Auto</option>
              <option value="whep">WHEP</option>
              <option value="hls">HLS</option>
            </select>
            <span class="info-value">${this.activeProtocol || '-'}</span>
          </div>
          ${this.streamStats.resolution || this.streamStats.codec ? html`
            <div class="info-row">
              <span class="info-label">Video</span>
              <span class="info-value">${this.streamStats.resolution || '-'} ${this.streamStats.framerate ? `@ ${this.streamStats.framerate}fps` : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Codec</span>
              <span class="info-value">${this.streamStats.codec || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bitrate</span>
              <span class="info-value">${this.streamStats.bitrate ? `${this.streamStats.bitrate} kbps` : '-'}</span>
            </div>
          ` : ''}
          <div class="info-controls">
            <button
              class="info-btn ${!this.muted ? 'active' : ''}"
              @click=${this.toggleMute}
            >${this.muted ? icons.micOff : icons.mic} ${this.muted ? 'Muted' : 'Audio'}</button>
            <button
              class="info-btn"
              @click=${this.reconnect}
            >${icons.refresh} Reconnect</button>
          </div>
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-player': FeedboardPlayer
  }
}
