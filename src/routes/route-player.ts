import { LitElement, html, css } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import '../elements/feedboard-header'
import '../elements/feedboard-player'
import type { FeedboardPlayer } from '../elements/feedboard-player'

/**
 * Player route - standalone video player
 */
@customElement('route-player')
export class RoutePlayer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0a0a0a;
    }
    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    feedboard-player {
      width: 100%;
      height: 100%;
    }
    .hint {
      position: fixed;
      bottom: 0.5rem;
      right: 0.5rem;
      color: rgba(255, 255, 255, 0.25);
      font-family: system-ui, sans-serif;
      font-size: 0.6rem;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .hint.hidden {
      opacity: 0;
    }
  `

  /** Stream source path (from route param or query) */
  @property() src = ''

  @state() private showInfo = false
  @query('#player') private player!: FeedboardPlayer

  connectedCallback() {
    super.connectedCallback()

    // Parse URL params as fallback
    const params = new URLSearchParams(window.location.search)
    if (!this.src && params.get('src')) {
      this.src = params.get('src')!
    }

    // Update document title
    if (this.src) {
      document.title = `${this.src} - Feedboard`
    }

    // Add keyboard listener
    document.addEventListener('keydown', this.handleKeydown)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this.handleKeydown)
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'SELECT') return

    switch (e.key.toLowerCase()) {
      case 'i':
        this.showInfo = !this.showInfo
        if (this.player) {
          this.player.showInfo = this.showInfo
        }
        e.preventDefault()
        break
      case 'm':
        if (this.player) {
          this.player.muted = !this.player.muted
        }
        break
      case 'r':
        if (this.player) {
          this.player.disconnect()
          this.player.connect()
        }
        break
      case 'f':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
        } else {
          document.exitFullscreen()
        }
        break
      case 'escape':
        if (this.showInfo) {
          this.showInfo = false
          if (this.player) {
            this.player.showInfo = false
          }
        }
        break
    }
  }

  protected firstUpdated() {
    // Parse additional params
    const params = new URLSearchParams(window.location.search)

    if (params.get('server') && this.player) {
      this.player.setAttribute('server', params.get('server')!)
    }
    if (params.get('protocol') && this.player) {
      this.player.setAttribute('protocol', params.get('protocol')!)
    }

    // Connect if we have a source
    if (this.src && this.player) {
      this.player.connect()
    }
  }

  render() {
    return html`
      <feedboard-header page="player"></feedboard-header>
      <div class="page-content">
        <feedboard-player
          id="player"
          src=${this.src}
          muted
          fill
        ></feedboard-player>
        <div class="hint ${this.showInfo ? 'hidden' : ''}">
          I: info · M: mute · R: reconnect · F: fullscreen
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-player': RoutePlayer
  }
}
