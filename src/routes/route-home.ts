import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'
import '../elements/feedboard-app'

/**
 * Home route - main multiview application
 * feedboard-app has its own header that shows only when UI is visible (editing mode)
 */
@customElement('route-home')
export class RouteHome extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    feedboard-app {
      height: 100%;
    }
  `

  render() {
    return html`<feedboard-app></feedboard-app>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-home': RouteHome
  }
}
