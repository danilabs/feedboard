import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { MediaMTXClient } from '@/lib/mediamtx-api'
import type { MediaMTXPath } from '@/types/mediamtx'

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4'

interface CellConfig {
  type: 'stream' | 'clock' | 'slate' | 'capture' | 'empty'
  src?: string
  text?: string
  timezone?: string
  label?: string
  format?: string
  background?: string
  color?: string
  publishPath?: string
}

@customElement('feedboard-app')
export class FeedboardApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100vh;
      background: #0a0a0a;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .sidebar {
      width: 280px;
      background: #141414;
      border-right: 1px solid #222;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 1rem;
      border-bottom: 1px solid #222;
    }

    .sidebar-header h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #fff;
    }

    .sidebar-header .subtitle {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.25rem;
    }

    .controls {
      padding: 1rem;
      border-bottom: 1px solid #222;
    }

    .layout-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .layout-btn {
      flex: 1;
      padding: 0.5rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s;
    }

    .layout-btn:hover {
      background: #333;
    }

    .layout-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
    }

    .clear-btn {
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: transparent;
      border: 1px solid #333;
      border-radius: 4px;
      color: #666;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.15s;
    }

    .clear-btn:hover {
      background: #2a1a1a;
      border-color: #633;
      color: #c66;
    }

    .streams-header {
      padding: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      letter-spacing: 0.05em;
    }

    .streams-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 0.5rem;
    }

    .stream-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .stream-item:hover {
      background: #1f1f1f;
    }

    .stream-item.selected {
      background: #1e3a5f;
    }

    .stream-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
    }

    .stream-status.ready {
      background: #22c55e;
    }

    .stream-name {
      flex: 1;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stream-readers {
      font-size: 0.75rem;
      color: #666;
    }

    .pop-out-btn {
      padding: 0.25rem 0.4rem;
      background: transparent;
      border: 1px solid #444;
      border-radius: 3px;
      color: #888;
      cursor: pointer;
      font-size: 0.65rem;
      opacity: 0;
      transition: all 0.15s;
    }

    .stream-item:hover .pop-out-btn {
      opacity: 1;
    }

    .pop-out-btn:hover {
      background: #333;
      border-color: #666;
      color: #fff;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: #141414;
      border-bottom: 1px solid #222;
    }

    .toolbar-btn {
      padding: 0.375rem 0.75rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.15s;
    }

    .toolbar-btn:hover {
      background: #333;
      color: #fff;
    }

    .toolbar-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #fff;
    }

    .toolbar-clock {
      margin-left: auto;
    }

    .grid-container {
      flex: 1;
      padding: 1rem;
      overflow: hidden;
    }

    feedboard-grid {
      width: 100%;
      height: 100%;
    }

    .empty-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      border: 2px dashed #333;
      color: #444;
      font-size: 0.875rem;
    }

    .refresh-btn {
      padding: 0.5rem 1rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .refresh-btn:hover {
      background: #333;
    }

    .section-header {
      padding: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      letter-spacing: 0.05em;
      border-top: 1px solid #222;
    }

    .sources-list {
      padding: 0 0.5rem 0.5rem;
    }

    .source-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .source-item:hover {
      background: #1f1f1f;
    }

    .source-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      background: #333;
      border-radius: 4px;
    }

    .source-icon.clock { background: #1e3a5f; }

    .source-name {
      flex: 1;
      font-size: 0.875rem;
    }

    .source-desc {
      font-size: 0.7rem;
      color: #666;
    }

    .clock-controls {
      padding: 0 0.5rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tz-select,
    .format-select,
    .label-input {
      width: 100%;
      padding: 0.5rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      font-size: 0.8rem;
      box-sizing: border-box;
    }

    .tz-select,
    .format-select {
      cursor: pointer;
    }

    .tz-select:hover,
    .format-select:hover,
    .label-input:hover {
      border-color: #444;
    }

    .tz-select:focus,
    .format-select:focus,
    .label-input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .label-input::placeholder {
      color: #555;
    }

    .add-clock-btn {
      width: 100%;
      padding: 0.5rem;
      background: #1e3a5f;
      border: 1px solid #2563eb;
      border-radius: 4px;
      color: #fff;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
      box-sizing: border-box;
    }

    .add-clock-btn:hover {
      background: #2563eb;
    }

    /* Fullscreen modes */
    :host(.fullscreen) .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    :host(.fullscreen) .sidebar.visible {
      transform: translateX(0);
    }

    :host(.fullscreen) .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      transform: translateY(-100%);
      transition: transform 0.2s ease;
    }

    :host(.fullscreen) .toolbar.visible {
      transform: translateY(0);
    }

    :host(.fullscreen) .grid-container {
      padding: 0;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      transition: left 0.2s ease;
    }

    :host(.fullscreen) .grid-container.sidebar-open {
      left: 220px;
    }

    /* Cell fullscreen */
    .cell-fullscreen {
      position: fixed !important;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 200;
    }

    /* Info overlay */
    .info-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      color: #fff;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.7rem;
      padding: 0.5rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      z-index: 10;
    }

    .info-title {
      font-weight: 600;
      font-size: 0.75rem;
      margin-bottom: 0.125rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      opacity: 0.8;
    }

    .info-label {
      color: #aaa;
    }

    .info-value {
      color: #fff;
      text-align: right;
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

    .info-select:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .info-select:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .info-controls {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.25rem;
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

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      flex-shrink: 0;
    }

    .status-dot.playing {
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
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

    .info-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cell-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
    }
  `

  @property({ type: String }) server = ''
  @property({ type: String, attribute: 'storage-key' }) storageKey = 'feedboard-layout'

  @state() private streams: MediaMTXPath[] = []
  @state() private layout: GridLayout = '2x2'
  @state() private cells: CellConfig[] = []
  @state() private selectedCell: number | null = null
  @state() private loading = false
  @state() private isFullscreen = false
  @state() private fullscreenCell: number | null = null
  @state() private sidebarVisible = true
  @state() private showInfo = false

  private client: MediaMTXClient | null = null
  private pollInterval: number | null = null
  private mouseTimeout: number | null = null

  // Common timezones for dropdown
  private timezones = [
    { value: '', label: 'Local' },
    { value: 'America/New_York', label: 'New York (EST)' },
    { value: 'America/Chicago', label: 'Chicago (CST)' },
    { value: 'America/Denver', label: 'Denver (MST)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
    { value: 'America/Anchorage', label: 'Anchorage (AKST)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HST)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
    { value: 'UTC', label: 'UTC' },
  ]

  @state() private selectedTimezone = ''
  @state() private clockLabel = 'Local'
  @state() private clockFormat = 'HH:mm:ss'
  @state() private capturePublishPath = '/webcam'


  connectedCallback() {
    super.connectedCallback()
    this.loadState()
    this.initClient()
    this.fetchStreams()

    // Poll for stream updates every 5 seconds
    this.pollInterval = window.setInterval(() => this.fetchStreams(), 5000)

    // Event listeners
    window.addEventListener('keydown', this.handleKeydown)
    document.addEventListener('fullscreenchange', this.handleFullscreenChange)
    this.addEventListener('mousemove', this.handleMouseMove)
  }

  private saveState() {
    try {
      const state = {
        layout: this.layout,
        cells: this.cells,
      }
      localStorage.setItem(this.storageKey, JSON.stringify(state))
    } catch (e) {
      console.warn('Failed to save layout:', e)
    }
  }

  private loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const state = JSON.parse(saved)
        if (state.layout) {
          this.layout = state.layout
        }
        if (state.cells && Array.isArray(state.cells)) {
          this.cells = state.cells
          return
        }
      }
    } catch (e) {
      console.warn('Failed to load layout:', e)
    }
    // Fall back to empty cells if nothing saved
    this.initCells()
  }

  private clearState() {
    localStorage.removeItem(this.storageKey)
    this.initCells()
    this.selectedCell = null
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
    if (this.mouseTimeout) {
      clearTimeout(this.mouseTimeout)
    }
    window.removeEventListener('keydown', this.handleKeydown)
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
    this.removeEventListener('mousemove', this.handleMouseMove)
  }

  private handleFullscreenChange = () => {
    this.isFullscreen = !!document.fullscreenElement
    if (this.isFullscreen) {
      this.classList.add('fullscreen')
      this.sidebarVisible = false
    } else {
      this.classList.remove('fullscreen')
      this.sidebarVisible = true
      this.fullscreenCell = null
    }
  }

  private handleMouseMove = () => {
    if (!this.isFullscreen) return

    this.sidebarVisible = true

    if (this.mouseTimeout) {
      clearTimeout(this.mouseTimeout)
    }

    this.mouseTimeout = window.setTimeout(() => {
      if (this.isFullscreen) {
        this.sidebarVisible = false
      }
    }, 2000)
  }

  private handleKeydown = (e: KeyboardEvent) => {
    // Ignore shortcuts when typing in inputs (except Escape)
    // Use composedPath to get actual target inside shadow DOM
    const target = (e.composedPath()[0] || e.target) as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA'

    // Escape to exit cell fullscreen or info (works even in inputs)
    if (e.key === 'Escape') {
      if (this.fullscreenCell !== null) {
        this.fullscreenCell = null
        e.preventDefault()
        return
      }
      if (this.showInfo) {
        this.showInfo = false
        e.preventDefault()
        return
      }
    }

    // Skip all other shortcuts when typing in inputs
    if (isInput) return

    // 0 to deselect and exit cell fullscreen
    if (e.key === '0') {
      this.selectedCell = null
      if (this.fullscreenCell !== null) {
        this.fullscreenCell = null
      }
      e.preventDefault()
    }

    // Number keys 1-9 to select cells (or switch when in cell fullscreen)
    if (e.key >= '1' && e.key <= '9') {
      const cellIndex = parseInt(e.key) - 1
      const maxCells = this.getGridCellCount()
      if (cellIndex < maxCells) {
        this.selectedCell = cellIndex
        // If viewing a single cell fullscreen, switch to the new cell
        if (this.fullscreenCell !== null) {
          this.fullscreenCell = cellIndex
        }
      }
      e.preventDefault()
    }

    // Enter to fullscreen selected cell
    if (e.key === 'Enter' && this.selectedCell !== null) {
      this.toggleCellFullscreen(this.selectedCell)
      e.preventDefault()
    }

    // I to toggle info overlay on all cells
    if (e.key === 'i' && !e.ctrlKey && !e.metaKey) {
      this.showInfo = !this.showInfo
      e.preventDefault()
    }

    // G to cycle grid size
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
      const layouts: GridLayout[] = ['1x1', '2x2', '3x3', '4x4']
      const currentIndex = layouts.indexOf(this.layout)
      this.setLayout(layouts[(currentIndex + 1) % layouts.length])
    }

    // F for fullscreen
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      if (!document.fullscreenElement) {
        this.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }

    // Arrow keys to navigate cells
    if (e.key.startsWith('Arrow') && this.selectedCell !== null) {
      const [rows] = this.layout.split('x').map(Number)
      const cols = rows
      let newCell = this.selectedCell

      switch (e.key) {
        case 'ArrowUp':
          newCell = this.selectedCell - cols
          break
        case 'ArrowDown':
          newCell = this.selectedCell + cols
          break
        case 'ArrowLeft':
          newCell = this.selectedCell - 1
          break
        case 'ArrowRight':
          newCell = this.selectedCell + 1
          break
      }

      if (newCell >= 0 && newCell < this.cells.length) {
        this.selectedCell = newCell
        e.preventDefault()
      }
    }

    // Delete/Backspace to clear selected cell
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedCell !== null) {
      this.clearCell(this.selectedCell)
      e.preventDefault()
    }
  }

  private toggleCellFullscreen(index: number) {
    if (this.fullscreenCell === index) {
      this.fullscreenCell = null
    } else {
      this.fullscreenCell = index
      // Enter browser fullscreen if not already
      if (!document.fullscreenElement) {
        this.requestFullscreen()
      }
    }
  }

  private toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  private getServerUrl(): string {
    if (this.server) return this.server
    // Default: assume MediaMTX on same host, port 8889
    return window.location.origin.replace(/:\d+$/, ':8889')
  }

  private getApiUrl(): string {
    return this.getServerUrl().replace(':8889', ':9997')
  }

  private initClient() {
    this.client = new MediaMTXClient(this.getApiUrl())
  }

  private initCells() {
    const count = this.getGridCellCount()
    this.cells = Array(count)
      .fill(null)
      .map(() => ({ type: 'empty' as const }))
  }

  private getGridCellCount(): number {
    const [rows, cols] = this.layout.split('x').map(Number)
    return rows * cols
  }

  private async fetchStreams() {
    if (!this.client) return
    this.loading = true
    try {
      this.streams = await this.client.listPaths()
    } catch (error) {
      console.error('Failed to fetch streams:', error)
    } finally {
      this.loading = false
    }
  }

  private setLayout(layout: GridLayout) {
    this.layout = layout
    this.initCells()
    this.selectedCell = null
    this.saveState()
  }

  private assignStreamToCell(path: string) {
    if (this.selectedCell === null) {
      // Find first empty cell
      const emptyIndex = this.cells.findIndex((c) => c.type === 'empty')
      if (emptyIndex !== -1) {
        this.selectedCell = emptyIndex
      } else {
        return
      }
    }

    const newCells = [...this.cells]
    newCells[this.selectedCell] = { type: 'stream', src: `/${path}` }
    this.cells = newCells
    this.saveState()

    // Move to next cell
    const nextCell = this.selectedCell + 1
    if (nextCell < this.cells.length) {
      this.selectedCell = nextCell
    } else {
      this.selectedCell = null
    }
  }

  private clearCell(index: number) {
    const newCells = [...this.cells]
    newCells[index] = { type: 'empty' }
    this.cells = newCells
    this.saveState()
  }

  private handleTimezoneChange(value: string) {
    this.selectedTimezone = value
    const tz = this.timezones.find((t) => t.value === value)
    this.clockLabel = tz?.label || 'Local'
  }

  private addClockToCell() {
    if (this.selectedCell === null) {
      const emptyIndex = this.cells.findIndex((c) => c.type === 'empty')
      if (emptyIndex !== -1) {
        this.selectedCell = emptyIndex
      } else {
        return
      }
    }

    const newCells = [...this.cells]
    newCells[this.selectedCell] = {
      type: 'clock',
      timezone: this.selectedTimezone,
      label: this.clockLabel,
      format: this.clockFormat,
      background: '#111',
      color: '#fff',
    }
    this.cells = newCells
    this.saveState()

    // Move to next cell
    const nextCell = this.selectedCell + 1
    if (nextCell < this.cells.length) {
      this.selectedCell = nextCell
    } else {
      this.selectedCell = null
    }
  }

  private openCaptureWindow() {
    const server = this.getServerUrl()
    const url = `/capture.html?server=${encodeURIComponent(server)}`
    window.open(url, 'feedboard-capture', 'width=500,height=600,resizable=yes')
  }

  private openStreamWindow(path: string) {
    const server = this.getServerUrl()
    const url = `/player.html?server=${encodeURIComponent(server)}&src=${encodeURIComponent('/' + path)}`
    window.open(url, `feedboard-${path}`, 'width=800,height=500,resizable=yes')
  }

  private renderCell(cell: CellConfig, index: number) {
    const isSelected = this.selectedCell === index
    const isCellFullscreen = this.fullscreenCell === index
    const showingInfo = this.showInfo === index

    const wrapperClasses = `cell-wrapper ${isCellFullscreen ? 'cell-fullscreen' : ''}`
    const outline = isSelected ? 'outline: 2px solid #3b82f6;' : ''

    const handleDblClick = (e: Event) => {
      e.preventDefault()
      this.toggleCellFullscreen(index)
    }

    const handleClick = () => {
      this.selectedCell = index
    }

    let content
    switch (cell.type) {
      case 'stream':
        content = html`
          <feedboard-player
            id="player-${index}"
            src=${cell.src || ''}
            server=${this.getServerUrl()}
            ?show-info=${this.showInfo}
            style="width: 100%; height: 100%;"
          ></feedboard-player>
        `
        break
      case 'clock':
        content = html`
          <feedboard-clock
            .format=${cell.format || 'HH:mm:ss'}
            .timezone=${cell.timezone || ''}
            .label=${cell.label || ''}
            .background=${cell.background || '#000'}
            .color=${cell.color || '#fff'}
            style="width: 100%; height: 100%;"
          ></feedboard-clock>
        `
        break
      case 'slate':
        content = html`
          <feedboard-slate
            text=${cell.text || ''}
            background=${cell.background || '#1a1a1a'}
            color=${cell.color || '#fff'}
            style="width: 100%; height: 100%;"
          ></feedboard-slate>
        `
        break
      case 'capture':
        content = html`
          <feedboard-capture
            id="capture-${index}"
            server=${this.getServerUrl()}
            publish-path=${cell.publishPath || '/webcam'}
            style="width: 100%; height: 100%;"
          ></feedboard-capture>
        `
        break
      default:
        content = html`
          <div class="empty-cell" style="width: 100%; height: 100%;">
            ${index + 1}
          </div>
        `
    }

    return html`
      <div
        class=${wrapperClasses}
        style=${outline}
        @click=${handleClick}
        @dblclick=${handleDblClick}
      >
        ${content}
        ${this.showInfo && cell.type !== 'empty' && cell.type !== 'stream' ? this.renderInfoOverlay(cell, index) : ''}
      </div>
    `
  }

  private renderInfoOverlay(cell: CellConfig, index: number) {
    if (cell.type === 'clock') {
      return html`
        <div class="info-overlay">
          <div class="info-title-row">
            <div class="status-dot playing"></div>
            <div class="info-title">${cell.label || 'Clock'}</div>
          </div>
          <div class="info-row">
            <span class="info-label">TZ</span>
            <span class="info-value">${cell.timezone || 'Local'}</span>
          </div>
        </div>
      `
    }

    if (cell.type === 'capture') {
      // Get capture status from the element
      const capture = this.shadowRoot?.querySelector(`#capture-${index}`) as any
      const status = capture?.status || 'idle'
      const statusClass = status === 'live' ? 'playing' : status

      return html`
        <div class="info-overlay">
          <div class="info-title-row">
            <div class="status-dot ${statusClass}"></div>
            <div class="info-title">Capture</div>
          </div>
          <div class="info-row">
            <span class="info-label">Publish</span>
            <span class="info-value">${cell.publishPath}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value">${status}</span>
          </div>
        </div>
      `
    }

    return html`
      <div class="info-overlay">
        <div class="info-title">${cell.type}</div>
      </div>
    `
  }

  render() {
    return html`
      <aside class="sidebar ${this.sidebarVisible ? 'visible' : ''}">
        <div class="sidebar-header">
          <h1>Feedboard</h1>
          <div class="subtitle">MediaMTX Multiview</div>
        </div>

        <div class="controls">
          <div class="layout-buttons">
            ${(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map(
              (l) => html`
                <button
                  class="layout-btn ${this.layout === l ? 'active' : ''}"
                  @click=${() => this.setLayout(l)}
                >
                  ${l}
                </button>
              `
            )}
          </div>
          <button
            class="clear-btn"
            @click=${() => this.clearState()}
            title="Clear all cells and reset layout"
          >
            Clear Layout
          </button>
        </div>

        <div class="streams-header">
          Streams (${this.streams.length})
          <button class="refresh-btn" @click=${() => this.fetchStreams()}>
            ${this.loading ? '...' : 'Refresh'}
          </button>
        </div>

        <div class="streams-list">
          ${this.streams.map(
            (stream) => html`
              <div class="stream-item" @click=${() => this.assignStreamToCell(stream.name)}>
                <div class="stream-status ${stream.ready ? 'ready' : ''}"></div>
                <span class="stream-name">${stream.name}</span>
                <span class="stream-readers">${stream.readers?.length || 0}</span>
                <button
                  class="pop-out-btn"
                  @click=${(e: Event) => {
                    e.stopPropagation()
                    this.openStreamWindow(stream.name)
                  }}
                  title="Open in new window"
                >POP</button>
              </div>
            `
          )}
        </div>

        <div class="section-header">Add Clock</div>
        <div class="clock-controls">
          <select
            class="tz-select"
            .value=${this.selectedTimezone}
            @change=${(e: Event) => this.handleTimezoneChange((e.target as HTMLSelectElement).value)}
          >
            ${this.timezones.map(
              (tz) => html`<option value=${tz.value}>${tz.label}</option>`
            )}
          </select>
          <input
            type="text"
            class="label-input"
            placeholder="Label"
            .value=${this.clockLabel}
            @input=${(e: Event) => (this.clockLabel = (e.target as HTMLInputElement).value)}
          />
          <select
            class="format-select"
            .value=${this.clockFormat}
            @change=${(e: Event) => (this.clockFormat = (e.target as HTMLSelectElement).value)}
          >
            <option value="HH:mm:ss">HH:mm:ss</option>
            <option value="HH:mm">HH:mm</option>
            <option value="HH:mm:ss:ff">Timecode</option>
          </select>
          <button class="add-clock-btn" @click=${() => this.addClockToCell()}>
            Add Clock
          </button>
        </div>

        <div class="section-header">Capture</div>
        <div class="clock-controls">
          <button class="add-clock-btn" @click=${() => this.openCaptureWindow()}>
            Open Capture Window
          </button>
        </div>

      </aside>

      <main class="main-area">
        <div class="toolbar ${this.sidebarVisible ? 'visible' : ''}">
          <span>Cell ${this.selectedCell !== null ? this.selectedCell + 1 : '-'}</span>
          <button
            class="toolbar-btn ${this.showInfo ? 'active' : ''}"
            @click=${() => (this.showInfo = !this.showInfo)}
            title="Toggle info overlay (I)"
          >
            Info
          </button>
          <button
            class="toolbar-btn ${this.isFullscreen ? 'active' : ''}"
            @click=${() => this.toggleFullscreen()}
            title="Toggle fullscreen (F)"
          >
            ${this.isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
          <span class="toolbar-clock">
            <feedboard-clock format="HH:mm:ss"></feedboard-clock>
          </span>
        </div>

        <div class="grid-container ${this.isFullscreen && this.sidebarVisible ? 'sidebar-open' : ''}">
          <feedboard-grid layout=${this.layout} gap="4px">
            ${this.cells.map((cell, i) => this.renderCell(cell, i))}
          </feedboard-grid>
        </div>
      </main>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-app': FeedboardApp
  }
}
