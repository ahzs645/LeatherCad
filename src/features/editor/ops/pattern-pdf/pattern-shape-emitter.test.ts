import { expect, it } from 'vitest'
import { sideToShapes } from './pattern-shape-emitter'

it('preserves authored PDF cubic controls without fitting a replacement arc', () => {
  const segment = { kind: 'cubic' as const, from: { x: 0, y: 0 }, c1: { x: 2, y: 70 }, c2: { x: 80, y: -20 }, to: { x: 50, y: 30 } }
  const emitted = sideToShapes({ id: 'side', kind: 'curve', start: segment.from, end: segment.to, polyline: [segment.from, segment.to], lengthMm: 100, segments: [segment] }, { idPrefix: 'boundary', layerId: 'layer', lineTypeId: 'cut' })
  expect(emitted).toEqual([{ id: 'boundary-1', type: 'cubic', layerId: 'layer', lineTypeId: 'cut', start: segment.from, control1: segment.c1, control2: segment.c2, end: segment.to }])
})
