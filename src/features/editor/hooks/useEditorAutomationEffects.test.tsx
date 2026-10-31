import { createElement, useState } from 'react'
import { expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import type { Shape } from '../cad/cad-types'
import { DEFAULT_AUTO_CONSTRAINT_SETTINGS } from '../ops/auto-constraint-ops'
import { useEditorAutomationEffects } from './useEditorAutomationEffects'

it('auto-paints closed native ellipses and cubics while leaving open native curves unpainted', () => {
  const initial: Shape[] = [
    { id: 'full', type: 'ellipse', layerId: 'L', lineTypeId: 'cut', center: { x: 0, y: 0 }, radiusX: 10, radiusY: 5, rotationDeg: 27, startAngleDeg: 13, sweepDeg: 360 },
    { id: 'partial', type: 'ellipse', layerId: 'L', lineTypeId: 'cut', center: { x: 20, y: 0 }, radiusX: 10, radiusY: 5, rotationDeg: 27, startAngleDeg: 13, sweepDeg: 180 },
    { id: 'closed-cubic', type: 'cubic', layerId: 'L', lineTypeId: 'cut', start: { x: 0, y: 0 }, control1: { x: 8, y: 10 }, control2: { x: -8, y: 10 }, end: { x: 0, y: 0 } },
  ]
  const types = { cut: { id: 'cut', name: 'Cut', role: 'cut' as const, style: 'solid' as const, color: '#123456', visible: true } }
  const settings = { ...DEFAULT_AUTO_CONSTRAINT_SETTINGS, enabled: false }
  function Harness() {
    const [shapes, setShapes] = useState(initial)
    useEditorAutomationEffects({ shapes, setShapes, fillOnChange: true, lineTypesById: types, autoConstraintSettings: settings, constraintSuggestions: [], setConstraintSuggestions() {} })
    return createElement('output', null, JSON.stringify(shapes))
  }
  const rendered = renderForTest(createElement(Harness))
  const shapes = JSON.parse(rendered.container.querySelector('output')!.textContent) as Array<{ id: string; fillColor?: string }>
  expect(shapes.find(shape => shape.id === 'full')?.fillColor).toBe('#123456')
  expect(shapes.find(shape => shape.id === 'closed-cubic')?.fillColor).toBe('#123456')
  expect(shapes.find(shape => shape.id === 'partial')?.fillColor).toBeUndefined()
  cleanupRender(rendered)
})
