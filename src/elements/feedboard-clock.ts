import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('feedboard-clock')
export class FeedboardClock extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      color: #fff;
      background: #000;
      gap: 0.25rem;
      overflow: hidden;
      container-type: size;
      padding: 0.5rem;
      box-sizing: border-box;
    }

    .time {
      font-size: clamp(1rem, 8cqw, 6rem);
      font-weight: bold;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .label {
      font-size: clamp(0.5rem, 2cqw, 1.25rem);
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }

    .date {
      font-size: clamp(0.5rem, 2.5cqw, 1.5rem);
      opacity: 0.6;
    }

    @supports not (font-size: 1cqw) {
      .time { font-size: clamp(1rem, 5vmin, 4rem); }
      .label { font-size: clamp(0.5rem, 1.5vmin, 1rem); }
      .date { font-size: clamp(0.5rem, 2vmin, 1.25rem); }
    }
  `

  @property({ type: String }) format = 'HH:mm:ss'
  @property({ type: String }) timezone = ''
  @property({ type: String }) label = ''
  @property({ type: String, attribute: 'show-date' }) showDate = ''
  @property({ type: String }) background = '#000'
  @property({ type: String }) color = '#fff'
  @property({ type: Number }) framerate = 30

  @state() private time = ''
  @state() private date = ''
  @state() private tzLabel = ''

  private intervalId: number | null = null

  connectedCallback() {
    super.connectedCallback()
    this.updateStyles()
    this.updateTime()
    // Use requestAnimationFrame for smooth frame counter, setInterval for seconds-only
    const hasFrames = this.format.includes('ff')
    if (hasFrames) {
      this.startAnimationLoop()
    } else {
      this.intervalId = window.setInterval(() => this.updateTime(), 200)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('background') || changedProperties.has('color')) {
      this.updateStyles()
    }
  }

  private updateStyles() {
    this.style.background = this.background
    this.style.color = this.color
  }

  private startAnimationLoop() {
    const tick = () => {
      this.updateTime()
      this.intervalId = requestAnimationFrame(tick) as unknown as number
    }
    tick()
  }

  private updateTime() {
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {}

    if (this.timezone) {
      options.timeZone = this.timezone
      // Get timezone abbreviation
      try {
        const tzName = now.toLocaleString('en-US', {
          timeZone: this.timezone,
          timeZoneName: 'short',
        })
        this.tzLabel = tzName.split(' ').pop() || this.timezone
      } catch {
        this.tzLabel = this.timezone
      }
    }

    // Parse format string
    let timeStr = this.format

    // Get time parts in the specified timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      ...options,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00'

    const hours = getPart('hour').padStart(2, '0')
    const minutes = getPart('minute').padStart(2, '0')
    const seconds = getPart('second').padStart(2, '0')
    const ms = now.getMilliseconds()
    const frames = Math.floor((ms / 1000) * this.framerate)
      .toString()
      .padStart(2, '0')

    timeStr = timeStr.replace('HH', hours)
    timeStr = timeStr.replace('mm', minutes)
    timeStr = timeStr.replace('ss', seconds)
    timeStr = timeStr.replace('ff', frames)

    this.time = timeStr

    // Update date if requested
    if (this.showDate) {
      const dateParts = new Intl.DateTimeFormat('en-US', {
        ...options,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now)

      const getDatePart = (type: string) => dateParts.find((p) => p.type === type)?.value || ''

      let dateStr = this.showDate
      dateStr = dateStr.replace('YYYY', getDatePart('year'))
      dateStr = dateStr.replace('MM', getDatePart('month'))
      dateStr = dateStr.replace('DD', getDatePart('day'))
      this.date = dateStr
    }
  }

  render() {
    const displayLabel = this.label || (this.timezone ? this.tzLabel : '')

    return html`
      ${displayLabel ? html`<div class="label">${displayLabel}</div>` : ''}
      <div class="time">${this.time}</div>
      ${this.date ? html`<div class="date">${this.date}</div>` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-clock': FeedboardClock
  }
}
