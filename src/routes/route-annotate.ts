import { LitElement, html, css } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import { checkAuth, canPublish } from '../lib/auth'
import { isAuthEnabled } from '../lib/config'
import '../elements/feedboard-header'
import '../elements/feedboard-player'
import { WhipClient } from '../lib/whip-client'
import { MediaMTXClient } from '../lib/mediamtx-api'
import { getApiUrl, getWebrtcUrl, buildWhipUrl, getStreamToken } from '../lib/config'
import type { FeedboardPlayer } from '../elements/feedboard-player'
import { icons } from '../lib/icons'

interface Point {
  x: number
  y: number
}

interface Stroke {
  tool: string
  color: string
  width: number
  opacity: number
  points: Point[]
}

type Tool = 'pen' | 'arrow' | 'rect' | 'circle' | 'line' | 'eraser'

/**
 * Annotate route - draw on video and publish
 * Requires publisher or admin role when auth is enabled
 */
@customElement('route-annotate')
export class RouteAnnotate extends LitElement {
  static styles = css`
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #555;
    }
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0a0a0a;
      color: #fff;
    }
    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .video-area {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .video-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    feedboard-player {
      width: 100%;
      height: 100%;
    }
    .draw-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: crosshair;
      z-index: 10;
      pointer-events: auto;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: nowrap;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      padding-bottom: calc(2.5rem + env(safe-area-inset-bottom, 35px));
      background: #111;
      flex-shrink: 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .toolbar button, .toolbar input, .toolbar select {
      padding: 0.3rem 0.5rem;
      background: #222;
      border: 1px solid #444;
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.7rem;
      white-space: nowrap;
      flex-shrink: 0;
      height: 34px;
      min-width: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .toolbar select {
      height: 34px;
      padding: 0 0.4rem;
    }
    .toolbar button:hover {
      background: #333;
    }
    .toolbar button.active {
      background: #d00;
      border-color: #f00;
    }
    .toolbar input[type="range"] {
      width: 50px;
      height: 34px;
      cursor: pointer;
      accent-color: #d00;
    }
    .slider-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: #1a1a1a;
      padding: 0 0.4rem;
      border-radius: 4px;
      height: 34px;
    }
    .slider-group label {
      font-size: 0.6rem;
      color: #999;
    }
    .color-palette {
      display: flex;
      gap: 2px;
    }
    .color-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: 2px solid #444;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
    .color-btn.active {
      border-color: #fff;
    }
    .tool-group {
      display: flex;
      gap: 1px;
      background: #1a1a1a;
      padding: 2px;
      border-radius: 4px;
    }
    .tool-group button {
      padding: 0.2rem;
      min-width: 32px;
      height: 32px;
    }
    .tool-group button svg {
      width: 16px;
      height: 16px;
    }
    .tool-group button.active {
      background: #444;
      border-color: #666;
    }
    .icon-btn {
      padding: 0.2rem;
    }
    .icon-btn svg {
      width: 16px;
      height: 16px;
    }
    .status {
      padding: 0.2rem 0.4rem;
      background: #222;
      border: 1px solid #444;
      border-radius: 4px;
      color: #888;
      font-family: system-ui, sans-serif;
      font-size: 0.6rem;
      height: 34px;
      display: flex;
      align-items: center;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status.live {
      color: #f00;
      border-color: #f00;
    }
  `

  @state() private authorized = false
  @state() private loading = true
  @state() private src = ''
  @state() private publishTo = ''
  @state() private streams: Array<{ name: string; ready: boolean }> = []
  @state() private tool: Tool = 'pen'
  @state() private color = '#ff0000'
  @state() private lineWidth = 4
  @state() private opacity = 1
  @state() private isPublishing = false
  @state() private statusText = 'Select a source stream'

  @query('#player') private player!: FeedboardPlayer
  @query('#drawCanvas') private drawCanvas!: HTMLCanvasElement
  @query('#sourceSelect') private sourceSelect!: HTMLSelectElement

  private drawCtx!: CanvasRenderingContext2D
  private outputCanvas!: HTMLCanvasElement
  private outputCtx!: CanvasRenderingContext2D
  private strokes: Stroke[] = []
  private currentStroke: Stroke | null = null
  private isDrawing = false
  private whipClient: WhipClient | null = null
  private animationId: number | null = null
  private client!: MediaMTXClient
  private colors = ['#ff0000', '#ffff00', '#00ff00', '#00bfff', '#ffffff']
  private params!: URLSearchParams
  private initialized = false

  async connectedCallback() {
    super.connectedCallback()

    // Check auth if enabled
    if (isAuthEnabled()) {
      const user = await checkAuth()
      if (!user) {
        window.location.href = '/login?redirect=/annotate'
        return
      }
      if (!canPublish()) {
        window.location.href = '/'
        return
      }
    }

    this.authorized = true
    this.loading = false

    this.params = new URLSearchParams(window.location.search)
    this.src = this.params.get('src') || ''
    this.publishTo = this.params.get('publish') || ''

    const apiUrl = this.params.get('api') || getApiUrl()
    this.client = new MediaMTXClient(apiUrl)

    document.addEventListener('keydown', this.handleKeydown)
    window.addEventListener('resize', this.resize)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this.handleKeydown)
    window.removeEventListener('resize', this.resize)
    if (this.animationId) cancelAnimationFrame(this.animationId)
    this.whipClient?.disconnect()
  }

  protected async updated() {
    // Initialize once after authorized content is rendered
    if (this.initialized || !this.authorized || !this.drawCanvas) return
    this.initialized = true

    this.drawCtx = this.drawCanvas.getContext('2d')!
    this.outputCanvas = document.createElement('canvas')
    this.outputCtx = this.outputCanvas.getContext('2d')!

    const server = this.params.get('server') || getWebrtcUrl()
    this.player.setAttribute('server', server)

    await this.loadStreams(true)
    setInterval(() => this.loadStreams(), 10000)

    this.initResize()
  }

  private async loadStreams(initialLoad = false) {
    try {
      const streams = await this.client.listPaths()
      this.streams = streams

      // Only connect on initial load if src is provided via URL
      if (initialLoad && this.src) {
        if (!this.publishTo) {
          this.publishTo = `${this.src}-annotated`
        }
        this.player.setAttribute('src', this.src)
        this.statusText = `Source: ${this.src}`
        await this.player.updateComplete
        this.player.connect()
      }
    } catch (err) {
      console.error('Failed to load streams:', err)
    }
  }

  private initResize = () => {
    this.resize()
    const video = this.player?.shadowRoot?.querySelector('video')
    if (!video || !video.videoWidth) {
      requestAnimationFrame(this.initResize)
    }
  }

  private resize = () => {
    const video = this.player?.shadowRoot?.querySelector('video')
    if (!video) {
      const rect = this.drawCanvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        this.drawCanvas.width = rect.width
        this.drawCanvas.height = rect.height
        this.outputCanvas.width = rect.width
        this.outputCanvas.height = rect.height
      }
      return
    }

    const videoRect = video.getBoundingClientRect()
    const containerRect = this.shadowRoot!.querySelector('.video-container')!.getBoundingClientRect()

    this.drawCanvas.style.left = (videoRect.left - containerRect.left) + 'px'
    this.drawCanvas.style.top = (videoRect.top - containerRect.top) + 'px'
    this.drawCanvas.style.width = videoRect.width + 'px'
    this.drawCanvas.style.height = videoRect.height + 'px'

    this.drawCanvas.width = video.videoWidth || videoRect.width
    this.drawCanvas.height = video.videoHeight || videoRect.height
    this.outputCanvas.width = this.drawCanvas.width
    this.outputCanvas.height = this.drawCanvas.height

    this.redraw()
  }

  private getPos(e: PointerEvent): Point {
    const rect = this.drawCanvas.getBoundingClientRect()
    const scaleX = this.drawCanvas.width / rect.width
    const scaleY = this.drawCanvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  private drawArrow(ctx: CanvasRenderingContext2D, start: Point, end: Point, headLen = 20) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const angle = Math.atan2(dy, dx)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }

  private redraw() {
    if (!this.drawCtx) return
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height)

    this.strokes.forEach(stroke => {
      this.drawCtx.globalAlpha = stroke.opacity || 1
      this.drawCtx.strokeStyle = stroke.color
      this.drawCtx.lineWidth = stroke.width
      this.drawCtx.lineCap = 'round'
      this.drawCtx.lineJoin = 'round'

      if (stroke.tool === 'eraser') {
        this.drawCtx.globalCompositeOperation = 'destination-out'
      } else {
        this.drawCtx.globalCompositeOperation = 'source-over'
      }

      const start = stroke.points[0]
      const end = stroke.points[stroke.points.length - 1]

      switch (stroke.tool) {
        case 'arrow':
          this.drawArrow(this.drawCtx, start, end)
          break
        case 'rect':
          this.drawCtx.beginPath()
          this.drawCtx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
          break
        case 'circle':
          const rx = Math.abs(end.x - start.x) / 2
          const ry = Math.abs(end.y - start.y) / 2
          const cx = start.x + (end.x - start.x) / 2
          const cy = start.y + (end.y - start.y) / 2
          this.drawCtx.beginPath()
          this.drawCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          this.drawCtx.stroke()
          break
        case 'line':
          this.drawCtx.beginPath()
          this.drawCtx.moveTo(start.x, start.y)
          this.drawCtx.lineTo(end.x, end.y)
          this.drawCtx.stroke()
          break
        default:
          this.drawCtx.beginPath()
          stroke.points.forEach((p, i) => {
            if (i === 0) this.drawCtx.moveTo(p.x, p.y)
            else this.drawCtx.lineTo(p.x, p.y)
          })
          this.drawCtx.stroke()
      }
    })
    this.drawCtx.globalAlpha = 1
    this.drawCtx.globalCompositeOperation = 'source-over'
  }

  private handlePointerDown = (e: PointerEvent) => {
    e.preventDefault()
    this.drawCanvas.setPointerCapture(e.pointerId)
    this.isDrawing = true
    this.currentStroke = {
      tool: this.tool,
      color: this.tool === 'eraser' ? '#000' : this.color,
      width: this.lineWidth,
      opacity: this.opacity,
      points: [this.getPos(e)],
    }

    if (this.tool === 'pen' || this.tool === 'eraser') {
      this.drawCtx.beginPath()
      this.drawCtx.strokeStyle = this.currentStroke.color
      this.drawCtx.lineWidth = this.lineWidth
      this.drawCtx.lineCap = 'round'
      this.drawCtx.lineJoin = 'round'
      this.drawCtx.globalAlpha = this.opacity
      if (this.tool === 'eraser') {
        this.drawCtx.globalCompositeOperation = 'destination-out'
      }
      this.drawCtx.moveTo(this.currentStroke.points[0].x, this.currentStroke.points[0].y)
    }
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDrawing || !this.currentStroke) return
    e.preventDefault()
    const pos = this.getPos(e)

    if (this.tool === 'pen' || this.tool === 'eraser') {
      this.currentStroke.points.push(pos)
      this.drawCtx.lineTo(pos.x, pos.y)
      this.drawCtx.stroke()
      this.drawCtx.beginPath()
      this.drawCtx.moveTo(pos.x, pos.y)
    } else {
      this.currentStroke.points[1] = pos
      this.redraw()
      this.drawCtx.globalAlpha = this.opacity
      this.drawCtx.strokeStyle = this.color
      this.drawCtx.lineWidth = this.lineWidth
      this.drawCtx.lineCap = 'round'
      this.drawCtx.lineJoin = 'round'
      const start = this.currentStroke.points[0]
      switch (this.tool) {
        case 'arrow':
          this.drawArrow(this.drawCtx, start, pos)
          break
        case 'rect':
          this.drawCtx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y)
          break
        case 'circle':
          const rx = Math.abs(pos.x - start.x) / 2
          const ry = Math.abs(pos.y - start.y) / 2
          const cx = start.x + (pos.x - start.x) / 2
          const cy = start.y + (pos.y - start.y) / 2
          this.drawCtx.beginPath()
          this.drawCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          this.drawCtx.stroke()
          break
        case 'line':
          this.drawCtx.beginPath()
          this.drawCtx.moveTo(start.x, start.y)
          this.drawCtx.lineTo(pos.x, pos.y)
          this.drawCtx.stroke()
          break
      }
      this.drawCtx.globalAlpha = 1
    }
  }

  private handlePointerUp = (e: PointerEvent) => {
    if (this.isDrawing && this.currentStroke && this.currentStroke.points.length > 1) {
      this.strokes.push(this.currentStroke)
    }
    this.isDrawing = false
    this.currentStroke = null
    this.drawCtx.globalAlpha = 1
    this.drawCtx.globalCompositeOperation = 'source-over'
    if (e.pointerId) {
      this.drawCanvas.releasePointerCapture(e.pointerId)
    }
    this.redraw()
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return

    switch (e.key.toLowerCase()) {
      case 'u': this.strokes.pop(); this.redraw(); break
      case 'c': this.strokes = []; this.redraw(); break
      case 'p': this.tool = 'pen'; break
      case 'a': this.tool = 'arrow'; break
      case 'r': this.tool = 'rect'; break
      case 'o': this.tool = 'circle'; break
      case 'l': this.tool = 'line'; break
      case 'e': this.tool = 'eraser'; break
      case 'f':
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          document.documentElement.requestFullscreen()
        }
        break
      case '1': case '2': case '3': case '4': case '5':
        this.color = this.colors[parseInt(e.key) - 1]
        break
      case '+': case '=':
        this.lineWidth = Math.min(20, this.lineWidth + 1)
        break
      case '-':
        this.lineWidth = Math.max(2, this.lineWidth - 1)
        break
    }
  }

  private handleSourceChange = async (e: Event) => {
    this.src = (e.target as HTMLSelectElement).value
    if (this.src) {
      this.player.setAttribute('src', this.src)
      this.publishTo = `${this.src}-annotated`
      this.statusText = `Source: ${this.src}`
      this.strokes = []
      this.redraw()
      await this.player.updateComplete
      this.player.connect()
    }
  }

  private renderComposite = () => {
    const video = this.player?.shadowRoot?.querySelector('video')
    if (video && video.readyState >= 2) {
      this.outputCtx.drawImage(video, 0, 0, this.outputCanvas.width, this.outputCanvas.height)
      this.outputCtx.drawImage(this.drawCanvas, 0, 0)
    }
    this.animationId = requestAnimationFrame(this.renderComposite)
  }

  private handlePublish = async () => {
    if (this.isPublishing) {
      if (this.animationId) cancelAnimationFrame(this.animationId)
      this.whipClient?.disconnect()
      this.whipClient = null
      this.isPublishing = false
      this.statusText = 'Not publishing'
      return
    }

    try {
      this.statusText = 'Connecting...'
      this.renderComposite()

      const fps = parseInt((this.shadowRoot!.querySelector('#quality') as HTMLSelectElement).value)
      const stream = this.outputCanvas.captureStream(fps)

      const server = this.params.get('server') || getWebrtcUrl()
      const whipUrl = this.params.get('server')
        ? `${server}${this.publishTo}/whip`
        : buildWhipUrl(this.publishTo)
      const token = await getStreamToken()
      this.whipClient = new WhipClient(whipUrl, token)
      await this.whipClient.publish(stream)

      this.isPublishing = true
      this.statusText = `LIVE ${fps}fps: ${this.publishTo}`
    } catch (err: any) {
      console.error('Failed to publish:', err)
      this.statusText = 'Error: ' + err.message
      if (this.animationId) cancelAnimationFrame(this.animationId)
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading...</div>`
    }

    if (!this.authorized) {
      return html``
    }

    return html`
      <feedboard-header page="annotate"></feedboard-header>
      <div class="page-content">
        <div class="video-area">
          <div class="video-container">
            <feedboard-player id="player" muted></feedboard-player>
            <canvas
              class="draw-canvas"
              id="drawCanvas"
              @pointerdown=${this.handlePointerDown}
              @pointermove=${this.handlePointerMove}
              @pointerup=${this.handlePointerUp}
              @pointercancel=${this.handlePointerUp}
            ></canvas>
          </div>
        </div>

        <div class="toolbar">
          <!-- Streaming controls first -->
          <select id="sourceSelect" @change=${this.handleSourceChange}>
            <option value="">Source...</option>
            ${this.streams.map(s => html`
              <option value="/${s.name}" ?selected=${this.src === '/' + s.name}>
                ${s.name}${s.ready ? ' (live)' : ''}
              </option>
            `)}
          </select>

          <select id="quality">
            <option value="30">30fps</option>
            <option value="60">60fps</option>
          </select>

          <button class=${this.isPublishing ? 'active' : ''} @click=${this.handlePublish}>
            ${this.isPublishing ? 'Stop' : 'Publish'}
          </button>

          <div class="status ${this.isPublishing ? 'live' : ''}">${this.statusText}</div>

          <!-- Drawing tools -->
          <div class="tool-group">
            <button class=${this.tool === 'pen' ? 'active' : ''} @click=${() => this.tool = 'pen'} title="Pen">${icons.penTool}</button>
            <button class=${this.tool === 'arrow' ? 'active' : ''} @click=${() => this.tool = 'arrow'} title="Arrow">${icons.arrowUpRight}</button>
            <button class=${this.tool === 'rect' ? 'active' : ''} @click=${() => this.tool = 'rect'} title="Rectangle">${icons.square}</button>
            <button class=${this.tool === 'circle' ? 'active' : ''} @click=${() => this.tool = 'circle'} title="Circle">${icons.circle}</button>
            <button class=${this.tool === 'line' ? 'active' : ''} @click=${() => this.tool = 'line'} title="Line">${icons.minus}</button>
            <button class=${this.tool === 'eraser' ? 'active' : ''} @click=${() => this.tool = 'eraser'} title="Eraser">${icons.eraser}</button>
          </div>

          <div class="color-palette">
            ${this.colors.map(c => html`
              <button
                class="color-btn ${this.color === c ? 'active' : ''}"
                style="background:${c}"
                @click=${() => this.color = c}
              ></button>
            `)}
          </div>

          <div class="slider-group">
            <label>Size</label>
            <input
              type="range"
              min="2"
              max="20"
              .value=${String(this.lineWidth)}
              @input=${(e: Event) => this.lineWidth = parseInt((e.target as HTMLInputElement).value)}
            >
          </div>

          <div class="slider-group">
            <label>Opac</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              .value=${String(this.opacity)}
              @input=${(e: Event) => this.opacity = parseFloat((e.target as HTMLInputElement).value)}
            >
          </div>

          <button class="icon-btn" @click=${() => { this.strokes.pop(); this.redraw() }} title="Undo">${icons.rotateCcw}</button>
          <button class="icon-btn" @click=${() => { this.strokes = []; this.redraw() }} title="Clear">${icons.trash}</button>
          <button class="icon-btn" @click=${() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()} title="Fullscreen">${icons.maximize}</button>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-annotate': RouteAnnotate
  }
}
