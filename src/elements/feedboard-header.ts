import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

interface AuthUser {
  id: number
  username: string
  role: 'viewer' | 'publisher' | 'admin'
}

@customElement('feedboard-header')
export class FeedboardHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: #111;
      border-bottom: 1px solid #1e1e1e;
    }

    :host([hidden]) {
      display: none;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      height: 48px;
    }

    .left {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
    }

    .logo svg {
      width: 24px;
      height: 24px;
      color: #3b82f6;
    }

    .logo span {
      font-weight: 600;
      font-size: 0.9rem;
      color: #fff;
    }

    nav {
      display: flex;
      gap: 0.25rem;
    }

    nav a {
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      color: #888;
      font-size: 0.8rem;
      text-decoration: none;
      transition: all 0.15s;
    }

    nav a:hover {
      background: #1a1a1a;
      color: #ccc;
    }

    nav a.active {
      background: #1e3a5f;
      color: #60a5fa;
    }

    .right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #888;
      font-size: 0.75rem;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.6rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .badge-admin { background: #7c3aed20; color: #a78bfa; }
    .badge-publisher { background: #05966920; color: #34d399; }
    .badge-viewer { background: #1e3a5f; color: #60a5fa; }

    .logout-btn {
      padding: 0.375rem 0.75rem;
      background: transparent;
      border: 1px solid #333;
      border-radius: 6px;
      color: #888;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .logout-btn:hover {
      border-color: #555;
      color: #ccc;
    }

    @media (max-width: 640px) {
      nav a span {
        display: none;
      }
      .user-info span:not(.badge) {
        display: none;
      }
    }
  `

  @property({ type: String }) page = ''
  @property({ type: Boolean, attribute: 'hide-nav' }) hideNav = false

  @state() private user: AuthUser | null = null
  @state() private authChecked = false
  @state() private isFullscreen = false

  connectedCallback() {
    super.connectedCallback()
    this.checkAuth()
    document.addEventListener('fullscreenchange', this.handleFullscreenChange)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
  }

  private handleFullscreenChange = () => {
    this.isFullscreen = !!document.fullscreenElement
    this.hidden = this.isFullscreen
  }

  private async checkAuth() {
    try {
      const res = await fetch('/auth/me', { credentials: 'same-origin' })
      if (res.ok) {
        this.user = await res.json()
      }
    } catch {
      // Auth not available
    }
    this.authChecked = true
  }

  private async logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/login.html'
  }

  render() {
    return html`
      <header class="header">
        <div class="left">
          <a href="/" class="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="2" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.15"/>
              <rect x="13" y="2" width="9" height="9" rx="1.5"/>
              <rect x="2" y="13" width="9" height="9" rx="1.5"/>
              <rect x="13" y="13" width="9" height="9" rx="1.5"/>
              <path d="M5.5 5L8 6.5 5.5 8z" fill="currentColor" stroke="none"/>
            </svg>
            <span>Feedboard</span>
          </a>

          ${!this.hideNav ? html`
            <nav>
              <a href="/" class=${this.page === 'app' ? 'active' : ''}>Multiview</a>
              <a href="/annotate.html" class=${this.page === 'annotate' ? 'active' : ''}>Annotate</a>
              ${this.user?.role === 'admin' ? html`
                <a href="/admin.html" class=${this.page === 'admin' ? 'active' : ''}>Admin</a>
              ` : ''}
            </nav>
          ` : ''}
        </div>

        <div class="right">
          ${this.authChecked && this.user ? html`
            <div class="user-info">
              <span>${this.user.username}</span>
              <span class="badge badge-${this.user.role}">${this.user.role}</span>
            </div>
            <button class="logout-btn" @click=${this.logout}>Logout</button>
          ` : ''}
        </div>
      </header>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-header': FeedboardHeader
  }
}
