import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { EditorStateProviders } from '../../state/providers/EditorStateProviders'
import { useEditorPanelSelector } from '../../state/providers/EditorPanelStateProvider'
import { cleanupRender, renderForTest } from '../../../../test/render'
import type { LineShape } from '../../cad/cad-types'
import { buildDxfFromShapes } from '../io-dxf'
import { importDxfDocument } from '../io-dxf-import'

describe('DXF editor coordinate defaults', () => {
  it('roundtrips asymmetric canvas geometry with the actual initial UI setting', () => {
    let flipY = false
    function Harness() { flipY = useEditorPanelSelector(state => state.dxfFlipY); return null }
    const rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
    try {
      expect(flipY).toBe(true)
      const line: LineShape = { id: 'line', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 10, y: 20 }, end: { x: 30, y: 50 } }
      const exported = buildDxfFromShapes([line], { flipY, version: 'r2004' })
      const imported = importDxfDocument(exported.content)
      expect(imported.shapes[0]).toMatchObject({ type: 'line', start: line.start, end: line.end })
      // The low-level explicit option still supports a caller's existing coordinate convention.
      const raw = importDxfDocument(buildDxfFromShapes([line], { flipY: false }).content)
      expect(raw.shapes[0]).toMatchObject({ start: { x: 10, y: -20 }, end: { x: 30, y: -50 } })
    } finally { cleanupRender(rendered) }
  })
})
