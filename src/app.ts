import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Router, Routes } from '@lit-labs/router'
import { initConfig, isAuthEnabled } from './lib/config'
import { checkAuth, isLoggedIn } from './lib/auth'

// Import route components
import './routes/route-home'
import './routes/route-admin'
import './routes/route-login'
import './routes/route-player'
import './routes/route-capture'
import './routes/route-annotate'

/**
 * Main SPA shell with client-side routing.
 *
 * Handles:
 * - Config loading at startup
 * - Auth checking when auth is enabled
 * - Client-side routing via @lit-labs/router
 */
@customElement('feedboard-spa')
export class FeedboardSpa extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      background: #0a0a0a;
      color: #fff;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #555;
      font-family: system-ui, sans-serif;
    }
    .route-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  `

  @state() private configLoaded = false
  @state() private authChecked = false

  private router = new Router(this, [
    {
      path: '/',
      render: () => html`<route-home></route-home>`,
    },
    {
      path: '/admin',
      render: () => html`<route-admin></route-admin>`,
    },
    {
      path: '/login',
      render: () => html`<route-login></route-login>`,
    },
    {
      path: '/player',
      render: () => {
        const params = new URLSearchParams(window.location.search)
        return html`<route-player .src=${params.get('src') || ''}></route-player>`
      },
    },
    {
      path: '/player/:src',
      render: ({ src }) => html`<route-player .src=${src || ''}></route-player>`,
    },
    {
      path: '/capture',
      render: () => html`<route-capture></route-capture>`,
    },
    {
      path: '/annotate',
      render: () => html`<route-annotate></route-annotate>`,
    },
  ])

  async connectedCallback() {
    super.connectedCallback()

    // Initialize config (loads from config.json or fallbacks)
    await initConfig()
    this.configLoaded = true

    // Check auth if enabled
    if (isAuthEnabled()) {
      await checkAuth()
    }
    this.authChecked = true
  }

  render() {
    // Show loading while config initializes
    if (!this.configLoaded) {
      return html`<div class="loading">Loading...</div>`
    }

    // Auth redirect logic
    if (isAuthEnabled() && this.authChecked) {
      const currentPath = window.location.pathname
      const isLoginPage = currentPath === '/login'

      // Redirect to login if not authenticated and not already on login page
      if (!isLoggedIn() && !isLoginPage) {
        // Check if this is a protected route (not public pages)
        const publicPaths = ['/login']
        if (!publicPaths.includes(currentPath)) {
          const redirectUrl = `/login?redirect=${encodeURIComponent(currentPath + window.location.search)}`
          window.history.pushState({}, '', redirectUrl)
          return html`<route-login></route-login>`
        }
      }
    }

    return html`
      <div class="route-container">
        ${this.router.outlet()}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-spa': FeedboardSpa
  }
}
