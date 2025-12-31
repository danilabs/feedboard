import { LitElement, html, css } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { checkAuth, canPublish } from '../lib/auth'
import { isAuthEnabled } from '../lib/config'
import '../elements/feedboard-header'
import '../elements/feedboard-capture'
import type { FeedboardCapture } from '../elements/feedboard-capture'

/**
 * Capture route - camera/screen capture and publish
 * Requires publisher or admin role when auth is enabled
 */
@customElement('route-capture')
export class RouteCapture extends LitElement {
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
    feedboard-capture {
      display: block;
      width: 100%;
      height: 100%;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #555;
    }
  `

  @state() private authorized = false
  @state() private loading = true
  @query('#capture') private capture!: FeedboardCapture
  private initialized = false

  async connectedCallback() {
    super.connectedCallback()

    // Check auth if enabled
    if (isAuthEnabled()) {
      const user = await checkAuth()
      if (!user) {
        window.location.href = '/login?redirect=/capture'
        return
      }
      if (!canPublish()) {
        // Viewer role can't publish
        window.location.href = '/'
        return
      }
    }

    this.authorized = true
    this.loading = false
  }

  protected updated() {
    // Initialize once after authorized content is rendered
    if (this.initialized || !this.authorized || !this.capture) return
    this.initialized = true

    const params = new URLSearchParams(window.location.search)

    if (params.get('server')) {
      this.capture.setAttribute('server', params.get('server')!)
    }
    if (params.get('path')) {
      this.capture.setAttribute('publish-to', params.get('path')!)
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
      <feedboard-header page="capture"></feedboard-header>
      <div class="page-content">
        <feedboard-capture id="capture" show-info></feedboard-capture>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-capture': RouteCapture
  }
}
