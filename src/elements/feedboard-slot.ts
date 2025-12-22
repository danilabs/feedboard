import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { setSlotDragData, parseDragData } from '@/lib/drag-utils'

export interface SlotConfig {
  type: 'stream' | 'clock' | 'slate' | 'capture' | 'empty'
  src?: string
  text?: string
  timezone?: string
  label?: string
  format?: string
  background?: string
  color?: string
  publishPath?: string
}

@customElement('feedboard-slot')
export class FeedboardSlot extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      box-sizing: border-box;
      /* Fill grid cell - parent grid maintains 16:9 */
      width: 100%;
      height: 100%;
    }

    .slot {
      width: 100%;
      height: 100%;
      position: relative;
      border: 2px solid transparent;
      border-radius: 4px;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    /* Empty state */
    .slot.empty {
      background: #111;
      border: 2px solid #222;
    }

    .slot.empty .empty-content {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: #333;
      font-size: 1.5rem;
      font-weight: 500;
    }

    /* Selected state */
    .slot.selected {
      border-color: #3b82f6;
      border-style: solid;
    }

    /* Drag over state */
    .slot.dragover {
      border-color: #22c55e;
      border-style: solid;
      box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.2);
    }

    /* Draggable cursor for non-empty slots */
    .slot:not(.empty) {
      cursor: grab;
    }

    .slot:not(.empty):active {
      cursor: grabbing;
    }

    /* Dragging state */
    .slot.dragging {
      opacity: 0.5;
    }

    /* Content fills the slot */
    .content {
      width: 100%;
      height: 100%;
    }

    .content > * {
      width: 100%;
      height: 100%;
    }

    /* Fullscreen mode */
    :host(.fullscreen) {
      position: fixed !important;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 200;
    }

    :host(.fullscreen) .slot {
      border-radius: 0;
    }
  `

  @property({ type: Object }) config: SlotConfig = { type: 'empty' }
  @property({ type: Boolean }) selected = false
  @property({ type: Number }) index = 0
  @property({ type: String }) server = ''
  @property({ type: Boolean, attribute: 'show-info' }) showInfo = false
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = true
  @property({ type: Boolean, attribute: 'show-vu' }) showVu = true

  @state() private dragOver = false
  @state() private dragging = false

  private handleDragStart = (e: DragEvent) => {
    if (this.config.type === 'empty') {
      e.preventDefault()
      return
    }

    this.dragging = true
    setSlotDragData(e, this.config, this.index)
  }

  private handleDragEnd = () => {
    this.dragging = false
    this.dragOver = false
  }

  private handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    this.dragOver = true
  }

  private handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    this.dragOver = false
  }

  private handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    this.dragOver = false

    const dragData = parseDragData(e)
    if (!dragData) return

    if (dragData.type === 'slot') {
      // From another slot
      this.dispatchEvent(
        new CustomEvent('slot-move', {
          detail: {
            config: dragData.data.config,
            sourceIndex: dragData.data.sourceIndex,
            targetIndex: this.index,
          },
          bubbles: true,
          composed: true,
        })
      )
    } else {
      // Stream path from sidebar
      this.dispatchEvent(
        new CustomEvent('slot-drop', {
          detail: { path: dragData.path, index: this.index },
          bubbles: true,
          composed: true,
        })
      )
    }
  }

  private handleClick = () => {
    this.dispatchEvent(
      new CustomEvent('slot-select', {
        detail: { index: this.index },
        bubbles: true,
        composed: true,
      })
    )
  }

  private handleDblClick = (e: Event) => {
    e.preventDefault()
    this.dispatchEvent(
      new CustomEvent('slot-fullscreen', {
        detail: { index: this.index },
        bubbles: true,
        composed: true,
      })
    )
  }

  /** Retry playback on the internal player (for autoplay unlock) */
  retryPlay(): void {
    const player = this.shadowRoot?.querySelector('feedboard-player') as any
    player?.retryPlay?.()
  }

  private renderContent() {
    const { config } = this

    switch (config.type) {
      case 'stream':
        return html`
          <feedboard-player
            src=${config.src || ''}
            server=${this.server}
            label=${config.label || ''}
            ?show-info=${this.showInfo}
            ?show-label=${this.showLabel}
            ?show-vu=${this.showVu}
          ></feedboard-player>
        `

      case 'clock':
        return html`
          <feedboard-clock
            .format=${config.format || 'HH:mm:ss'}
            .timezone=${config.timezone || ''}
            .label=${config.label || ''}
            .background=${config.background || '#000'}
            .color=${config.color || '#fff'}
          ></feedboard-clock>
        `

      case 'slate':
        return html`
          <feedboard-slate
            text=${config.text || ''}
            background=${config.background || '#1a1a1a'}
            color=${config.color || '#fff'}
          ></feedboard-slate>
        `

      case 'capture':
        return html`
          <feedboard-capture
            server=${this.server}
            publish-to=${config.publishPath || ''}
            ?show-info=${this.showInfo}
            ?show-label=${this.showLabel}
            ?show-vu=${this.showVu}
          ></feedboard-capture>
        `

      default:
        return html`
          <div class="empty-content">${this.index + 1}</div>
        `
    }
  }

  render() {
    const isEmpty = this.config.type === 'empty'
    const classes = [
      'slot',
      isEmpty ? 'empty' : '',
      this.selected ? 'selected' : '',
      this.dragOver ? 'dragover' : '',
      this.dragging ? 'dragging' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return html`
      <div
        class=${classes}
        draggable=${isEmpty ? 'false' : 'true'}
        @dragstart=${this.handleDragStart}
        @dragend=${this.handleDragEnd}
        @click=${this.handleClick}
        @dblclick=${this.handleDblClick}
        @dragover=${this.handleDragOver}
        @dragleave=${this.handleDragLeave}
        @drop=${this.handleDrop}
      >
        <div class="content">
          ${this.renderContent()}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feedboard-slot': FeedboardSlot
  }
}
