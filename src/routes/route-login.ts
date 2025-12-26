import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { refreshAuth } from '../lib/auth'

/**
 * Login route - authentication form
 */
@customElement('route-login')
export class RouteLogin extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #0a0a0a;
    }
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .login-box {
      width: 100%;
      max-width: 360px;
      background: #111;
      border: 1px solid #1e1e1e;
      border-radius: 12px;
      padding: 2rem;
    }
    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .login-logo {
      width: 48px;
      height: 48px;
      color: #3b82f6;
      margin-bottom: 1rem;
    }
    .login-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 0;
    }
    .login-subtitle {
      font-size: 0.75rem;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0.25rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: #888;
      margin-bottom: 0.5rem;
    }
    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      color: #fff;
      font-size: 0.875rem;
      transition: border-color 0.15s, background 0.15s;
      box-sizing: border-box;
    }
    .form-input:focus {
      outline: none;
      border-color: #2563eb;
      background: #1a1a1a;
    }
    .form-input::placeholder {
      color: #444;
    }
    .login-btn {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #1e3a5f;
      border: 1px solid #2563eb;
      border-radius: 8px;
      color: #60a5fa;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      margin-top: 0.5rem;
    }
    .login-btn:hover {
      background: #234876;
      color: #93c5fd;
    }
    .login-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-message {
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid #7f1d1d;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #f87171;
      font-size: 0.8rem;
      margin-bottom: 1rem;
    }
  `

  @state() private error = ''
  @state() private loading = false

  private get redirect(): string {
    const params = new URLSearchParams(window.location.search)
    return params.get('redirect') || '/'
  }

  async connectedCallback() {
    super.connectedCallback()
    // Check if already logged in
    try {
      const res = await fetch('/auth/me', { credentials: 'same-origin' })
      if (res.ok) {
        window.location.href = this.redirect
      }
    } catch {
      // Not logged in - stay on login page
    }
  }

  private async handleSubmit(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    this.loading = true
    this.error = ''

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
        credentials: 'same-origin',
      })

      if (res.ok) {
        await refreshAuth()
        window.location.href = this.redirect
      } else {
        const text = await res.text()
        this.error = text || 'Login failed'
      }
    } catch {
      this.error = 'Network error. Please try again.'
    } finally {
      this.loading = false
    }
  }

  render() {
    return html`
      <div class="login-container">
        <div class="login-box">
          <div class="login-header">
            <svg class="login-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.15"/>
              <rect x="13" y="2" width="9" height="9" rx="1.5"/>
              <rect x="2" y="13" width="9" height="9" rx="1.5"/>
              <rect x="13" y="13" width="9" height="9" rx="1.5"/>
              <path d="M5.5 5L8 6.5 5.5 8z" fill="currentColor" stroke="none"/>
            </svg>
            <h1 class="login-title">Feedboard</h1>
            <p class="login-subtitle">Sign in to continue</p>
          </div>

          ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}

          <form @submit=${this.handleSubmit}>
            <div class="form-group">
              <label class="form-label" for="username">Username</label>
              <input type="text" id="username" name="username" class="form-input"
                placeholder="Enter username" autocomplete="username" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <input type="password" id="password" name="password" class="form-input"
                placeholder="Enter password" autocomplete="current-password" required>
            </div>
            <button type="submit" class="login-btn" ?disabled=${this.loading}>
              ${this.loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-login': RouteLogin
  }
}
