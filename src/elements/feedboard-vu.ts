import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { PPMMeter, dbfsToPercent, type PPMMeterData } from '@/lib/ppm-meter'

@customElement('feedboard-vu')
export class FeedboardVu extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      right: 0.5rem;
      top: 0.5rem;
      bottom: 0.5rem;
      width: 8px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 4px;
      overflow: hidden;
      z-index: 15;
    }

    :host([stereo]) {
      width: 18px;
      padding: 2px;
    }

    .channels {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      gap: 2px;
    }

    .channel {
      flex: 1;
      display: flex;
      flex-direction: column-reverse;
      position: relative;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      overflow: hidden;
    }

    .level {
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

    .peak {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: #fff;
      transition: bottom 0.02s linear;
    }

    /* dBFS scale markers on hover */
    :host(:hover)::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 10%;
      height: 1px;
      background: rgba(255, 255, 255, 0.3);
      z-index: 1;
    }

    :host(:hover)::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 30%;
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      z-index: 1;
    }
  `

  @property({ type: Object }) stream: MediaStream | null = null

  @state() private meterData: PPMMeterData | null = null

  private ppmMeter: PPMMeter | null = null
  private needsRetry = false
  private boundRetryHandler: (() => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    // Listen for user-gesture events (bubbles up from player when user clicks play)
    this.boundRetryHandler = this.handleUserGesture.bind(this)
    window.addEventListener('user-gesture', this.boundRetryHandler)
    // Also listen for any click/touch as fallback
    document.addEventListener('click', this.boundRetryHandler, { once: false })
    document.addEventListener('touchstart', this.boundRetryHandler, { once: false })
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('stream')) {
      this.handleStreamChange()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopMeter()
    if (this.boundRetryHandler) {
      window.removeEventListener('user-gesture', this.boundRetryHandler)
      document.removeEventListener('click', this.boundRetryHandler)
      document.removeEventListener('touchstart', this.boundRetryHandler)
    }
  }

  private handleUserGesture() {
    if (this.needsRetry && this.stream && !this.ppmMeter?.isConnected) {
      this.tryConnect()
    }
  }

  private async handleStreamChange() {
    this.stopMeter()
    this.needsRetry = false

    if (!this.stream) {
      this.meterData = null
      return
    }

    const audioTracks = this.stream.getAudioTracks()
    if (audioTracks.length === 0) {
      this.meterData = null
      return
    }

    await this.tryConnect()
  }

  private async tryConnect() {
    if (!this.stream) return

    try {
      this.ppmMeter = new PPMMeter({
        onData: (data) => {
          this.meterData = data
        }
      })
      await this.ppmMeter.connect(this.stream)
      this.needsRetry = false
    } catch (e) {
      console.warn('[feedboard-vu] Could not start meter, will retry on user gesture:', e)
      this.needsRetry = true
    }
  }

  private stopMeter() {
    if (this.ppmMeter) {
      this.ppmMeter.disconnect()
      this.ppmMeter = null
    }
  }

  render() {
    if (!this.meterData) {
      return html``
    }

    const isStereo = this.meterData.channels > 1

    // Update stereo attribute for CSS
    if (isStereo) {
      this.setAttribute('stereo', '')
    } else {
      this.removeAttribute('stereo')
    }

    return html`
      <div class="channels">
        <div class="channel">
          <div class="level" style="height: ${dbfsToPercent(this.meterData.level[0])}%"></div>
          <div class="peak" style="bottom: ${dbfsToPercent(this.meterData.peak[0])}%"></div>
        </div>
        ${isStereo ? html`
          <div class="channel">
            <div class="level" style="height: ${dbfsToPercent(this.meterData.level[1])}%"></div>
            <div class="peak" style="bottom: ${dbfsToPercent(this.meterData.peak[1])}%"></div>
          </div>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-vu': FeedboardVu
  }
}
