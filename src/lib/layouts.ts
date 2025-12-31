export interface LayoutSlot {
  id: string
  gridArea?: string
  style?: string
}

export interface LayoutTemplate {
  id: string
  name: string
  slots: LayoutSlot[]
  containerStyle: string
}

export const layouts: LayoutTemplate[] = [
  {
    id: '1x1',
    name: 'Single',
    slots: [{ id: 'slot-0' }],
    containerStyle: 'display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr;',
  },
  {
    id: '2x2',
    name: '2×2',
    slots: [
      { id: 'slot-0' },
      { id: 'slot-1' },
      { id: 'slot-2' },
      { id: 'slot-3' },
    ],
    containerStyle: 'display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;',
  },
  {
    id: '3x3',
    name: '3×3',
    slots: [
      { id: 'slot-0' },
      { id: 'slot-1' },
      { id: 'slot-2' },
      { id: 'slot-3' },
      { id: 'slot-4' },
      { id: 'slot-5' },
      { id: 'slot-6' },
      { id: 'slot-7' },
      { id: 'slot-8' },
    ],
    containerStyle: 'display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);',
  },
  {
    id: '4x4',
    name: '4×4',
    slots: Array.from({ length: 16 }, (_, i) => ({ id: `slot-${i}` })),
    containerStyle: 'display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr);',
  },
  {
    id: 'focus',
    name: 'Focus',
    slots: [
      { id: 'slot-0', gridArea: 'main' },
      { id: 'slot-1', gridArea: 's1' },
      { id: 'slot-2', gridArea: 's2' },
      { id: 'slot-3', gridArea: 's3' },
      { id: 'slot-4', gridArea: 's4' },
      { id: 'slot-5', gridArea: 's5' },
    ],
    containerStyle: `
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
      grid-template-areas:
        "main main s1"
        "main main s2"
        "s3 s4 s5";
    `,
  },
]

export function getLayout(id: string): LayoutTemplate | undefined {
  return layouts.find((l) => l.id === id)
}

export function getLayoutIds(): string[] {
  return layouts.map((l) => l.id)
}
