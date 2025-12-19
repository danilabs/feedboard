import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('feedboard-slate')
export class FeedboardSlate extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font-family: system-ui, sans-serif;
      font-size: 1.5rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  `

  @property({ type: String }) text = ''
  @property({ type: String }) background = '#1a1a1a'
  @property({ type: String }) color = '#ffffff'
  @property({ type: String }) image = ''

  updated() {
    this.style.background = this.image ? `url(${this.image}) center/cover` : this.background
    this.style.color = this.color
  }

  connectedCallback() {
    super.connectedCallback()
    this.style.background = this.image ? `url(${this.image}) center/cover` : this.background
    this.style.color = this.color
  }

  render() {
    return html`${this.text}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-slate': FeedboardSlate
  }
}
