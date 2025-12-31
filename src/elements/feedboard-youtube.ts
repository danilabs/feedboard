import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

/**
 * YouTube embed component
 *
 * Accepts various YouTube URL formats and renders an iframe embed.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/live/, youtube.com/embed/
 */
@customElement('feedboard-youtube')
export class FeedboardYoutube extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: #000;
    }
    .container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .error {
      color: #666;
      font-size: 0.75rem;
      text-align: center;
      padding: 1rem;
    }
    .label {
      position: absolute;
      bottom: 0.5rem;
      left: 0.5rem;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      font-size: 0.65rem;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .yt-icon {
      width: 12px;
      height: 12px;
      background: #f00;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .yt-icon::after {
      content: '';
      border: 3px solid transparent;
      border-left: 5px solid #fff;
      margin-left: 2px;
    }
    .info-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
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
      display: flex;
      align-items: center;
      gap: 0.4rem;
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
      word-break: break-all;
    }
    .yt-badge {
      background: #f00;
      color: #fff;
      font-size: 0.55rem;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      font-weight: 600;
      font-family: system-ui, sans-serif;
    }
  `

  @property({ type: String }) src = ''
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false
  @property({ type: Boolean, attribute: 'show-info' }) showInfo = false

  /**
   * Extract video ID from various YouTube URL formats
   */
  private getVideoId(): string | null {
    if (!this.src) return null

    const url = this.src.trim()

    // Already just a video ID (11 chars, alphanumeric + dash/underscore)
    if (/^[\w-]{11}$/.test(url)) {
      return url
    }

    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.replace('www.', '')

      // youtube.com/watch?v=VIDEO_ID
      if (hostname === 'youtube.com' && parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }

      // youtube.com/live/VIDEO_ID or youtube.com/embed/VIDEO_ID
      if (hostname === 'youtube.com') {
        const match = parsed.pathname.match(/^\/(live|embed)\/([\w-]{11})/)
        if (match) return match[2]
      }

      // youtu.be/VIDEO_ID
      if (hostname === 'youtu.be') {
        const match = parsed.pathname.match(/^\/([\w-]{11})/)
        if (match) return match[1]
      }
    } catch {
      // Not a valid URL
    }

    return null
  }

  /**
   * Get a display label for the video
   */
  private getLabel(): string {
    const videoId = this.getVideoId()
    return videoId ? `YT: ${videoId}` : 'YouTube'
  }

  render() {
    const videoId = this.getVideoId()

    if (!videoId) {
      return html`
        <div class="container">
          <div class="error">Invalid YouTube URL</div>
        </div>
      `
    }

    // Use youtube-nocookie.com for privacy-enhanced mode
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`

    return html`
      <div class="container">
        <iframe
          src="${embedUrl}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
        ${this.showLabel && !this.showInfo ? html`
          <div class="label">
            <span class="yt-icon"></span>
            ${this.getLabel()}
          </div>
        ` : ''}
        ${this.showInfo ? html`
          <div class="info-overlay">
            <div class="info-title">
              <span class="yt-badge">YT</span>
              ${videoId}
            </div>
            <div class="info-row">
              <span class="info-label">Source</span>
              <span class="info-value">${this.src}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Embed</span>
              <span class="info-value">youtube-nocookie.com</span>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-youtube': FeedboardYoutube
  }
}
