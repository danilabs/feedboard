import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4'

@customElement('feedboard-grid')
export class FeedboardGrid extends LitElement {
  static styles = css`
    :host {
      display: grid;
      width: 100%;
      height: 100%;
      background: #111;
      justify-content: center;
      align-content: center;
    }

    :host([layout='1x1']) {
      grid-template-columns: 1fr;
    }

    :host([layout='2x2']) {
      grid-template-columns: 1fr 1fr;
    }

    :host([layout='3x3']) {
      grid-template-columns: 1fr 1fr 1fr;
    }

    :host([layout='4x4']) {
      grid-template-columns: 1fr 1fr 1fr 1fr;
    }

    ::slotted(*) {
      aspect-ratio: 16/9;
      min-width: 0;
      overflow: hidden;
    }
  `

  @property({ type: String, reflect: true }) layout: GridLayout = '2x2'
  @property({ type: String }) server = ''
  @property({ type: String }) gap = '2px'

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('gap')) {
      this.style.gap = this.gap
    }
  }

  connectedCallback() {
    super.connectedCallback()
    this.style.gap = this.gap
  }

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-grid': FeedboardGrid
  }
}
