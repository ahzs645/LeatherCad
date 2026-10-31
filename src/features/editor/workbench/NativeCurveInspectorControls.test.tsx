import { createElement, useLayoutEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EllipseShape } from '../cad/cad-types'
import { EditorStateProviders } from '../state/providers/EditorStateProviders'
import { useEditorDocumentStateApi } from '../state/providers/EditorDocumentStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'
import { changeValue, cleanupRender, click, renderForTest } from '../../../test/render'
import { NativeCurveInspectorControls } from './NativeCurveInspectorControls'
import { setEditorLocale } from '../ops/locale-store'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null; localStorage.clear(); setEditorLocale('en') })

const ellipse: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', center: { x: 0, y: 0 }, radiusX: 25.4, radiusY: 12.7, rotationDeg: 30, startAngleDeg: 0, sweepDeg: 360 }

function setup(locked = false) {
  let doc!: ReturnType<typeof useEditorDocumentStateApi>
  function Harness() {
    doc = useEditorDocumentStateApi()
    const { setDisplayUnit } = useEditorUIActions()
    const { setShapes } = doc
    useLayoutEffect(() => { setShapes([{ ...ellipse, locked }]); setDisplayUnit('in') }, [setShapes, setDisplayUnit])
    const shape = doc.shapes[0]
    return shape?.type === 'ellipse' ? createElement(NativeCurveInspectorControls, { shape, key: JSON.stringify(shape) }) : null
  }
  setEditorLocale('en')
  rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
  return { getDoc: () => doc, container: rendered.container }
}

describe('native geometry inspector', () => {
  it('edits in display units, validates a draft, and applies one canonical-mm primitive', () => {
    const { getDoc, container } = setup()
    const centerX = container.querySelector<HTMLInputElement>('input[aria-label="Center X (in)"]')
    changeValue(centerX, '1')
    expect(getDoc().shapes[0]).toMatchObject({ center: { x: 0 } })
    click(container.querySelector('button'))
    expect(getDoc().shapes[0]).toMatchObject({ type: 'ellipse', center: { x: 25.4, y: 0 }, radiusX: 25.4, radiusY: 12.7 })
    const radiusX = [...container.querySelectorAll('label')].find(label => label.textContent?.includes('Radius X'))?.querySelector('input')
    changeValue(radiusX ?? null, '0')
    click(container.querySelector('button'))
    expect(container.textContent).toMatch(/positive radii/)
    expect(container.querySelector('button')?.disabled).toBe(true)
    expect(getDoc().shapes[0]).toMatchObject({ radiusX: 25.4 })
  })

  it('disables geometry editing for a locked primitive', () => {
    const { container, getDoc } = setup(true)
    expect(container.querySelector('fieldset')?.disabled).toBe(true)
    expect(getDoc().shapes[0]).toMatchObject({ locked: true, radiusX: 25.4 })
  })
})
