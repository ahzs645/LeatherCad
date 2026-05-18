import { createElement, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import type { Shape } from '../cad/cad-types'
import { useGeometryEditingActions } from './useGeometryEditingActions'

type RenderedShape = {
  id: string
  type: Shape['type']
  startX: number | null
  controlX: number | null
  endX: number | null
}

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

const axisLine: Shape = {
  id: 'axis-line',
  type: 'line',
  layerId: 'layer-1',
  lineTypeId: 'cut',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 20 },
}

const sourceBezier: Shape = {
  id: 'source-bezier',
  type: 'bezier',
  layerId: 'layer-1',
  lineTypeId: 'cut',
  start: { x: 4, y: 2 },
  control: { x: 6, y: 8 },
  end: { x: 4, y: 14 },
}

function Harness() {
  const [shapes, setShapes] = useState<Shape[]>([axisLine, sourceBezier])
  const [status, setStatus] = useState('')
  const actions = useGeometryEditingActions({
    shapes,
    setShapes,
    selectedShapeIdSet: new Set(['axis-line', 'source-bezier']),
    setSelectedShapeIds: () => undefined,
    activeLayerId: 'layer-1',
    activeLineTypeId: 'cut',
    setStatus,
    showBezierOffsetLines: false,
    setShowBezierOffsetLines: () => undefined,
  })

  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => actions.handleLineSymmetry() }, 'Line Symmetry'),
    createElement('output', { 'data-testid': 'status' }, status),
    createElement(
      'output',
      { 'data-testid': 'shapes' },
      JSON.stringify(
        shapes.map((shape) => ({
          id: shape.id,
          type: shape.type,
          startX: 'start' in shape ? shape.start.x : null,
          controlX: shape.type === 'bezier' ? shape.control.x : null,
          endX: 'end' in shape ? shape.end.x : null,
        })),
      ),
    ),
  )
}

describe('useGeometryEditingActions', () => {
  it('uses a single selected line as the symmetry axis for the other selected shapes', () => {
    lastRender = renderForTest(createElement(Harness))

    click(lastRender.container.querySelector('button'))

    const status = lastRender.container.querySelector('[data-testid="status"]')?.textContent
    const shapes = JSON.parse(
      lastRender.container.querySelector('[data-testid="shapes"]')?.textContent ?? '[]',
    ) as RenderedShape[]

    expect(status).toBe('Created 1 symmetric copy')
    expect(shapes).toHaveLength(3)
    expect(shapes[2]).toMatchObject({
      type: 'bezier',
      startX: -4,
      controlX: -6,
      endX: -4,
    })
  })
})
