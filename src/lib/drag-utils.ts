// Drag-and-drop utilities for feedboard

export interface SlotDragData {
  type: 'slot-config'
  config: unknown
  sourceIndex: number
}

/**
 * Set up drag data for a stream path (from sidebar)
 */
export function setStreamDragData(e: DragEvent, streamPath: string): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('text/plain', streamPath)
  e.dataTransfer.effectAllowed = 'copyMove'
}

/**
 * Set up drag data for a slot config (from grid slots)
 */
export function setSlotDragData(e: DragEvent, config: unknown, sourceIndex: number): void {
  if (!e.dataTransfer) return
  const data: SlotDragData = {
    type: 'slot-config',
    config,
    sourceIndex,
  }
  const json = JSON.stringify(data)
  e.dataTransfer.setData('application/json', json)
  e.dataTransfer.setData('text/plain', json) // Fallback for cross-window
  e.dataTransfer.effectAllowed = 'move'
}

/**
 * Parse drag data from a drop event
 * Returns either a slot config or a stream path
 */
export function parseDragData(e: DragEvent):
  | { type: 'slot'; data: SlotDragData }
  | { type: 'stream'; path: string }
  | null {
  const jsonData = e.dataTransfer?.getData('application/json') || e.dataTransfer?.getData('text/plain')
  if (!jsonData) return null

  try {
    const parsed = JSON.parse(jsonData)
    if (parsed.type === 'slot-config' && parsed.config) {
      return { type: 'slot', data: parsed as SlotDragData }
    }
  } catch {
    // Not JSON, treat as stream path
  }

  return { type: 'stream', path: jsonData }
}

/**
 * CSS to prevent child elements from capturing drag events
 * Apply this to draggable containers
 */
export const dragChildCSS = `
  /* Prevent child elements from capturing drag */
  img, svg, button {
    -webkit-user-drag: none;
    user-drag: none;
    pointer-events: none;
  }

  /* Re-enable pointer events for buttons */
  button {
    pointer-events: auto;
  }
`
