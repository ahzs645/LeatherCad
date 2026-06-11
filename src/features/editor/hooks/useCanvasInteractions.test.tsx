import { act, createElement, useEffect, useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import type { LineType, Shape } from '../cad/cad-types'
import { DEFAULT_SNAP_SETTINGS } from '../editor-constants'
import { EditorPanelStateProvider } from '../state/providers/EditorPanelStateProvider'
import { EditorToolStateProvider, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { EditorUIStateProvider } from '../state/providers/EditorUIStateProvider'
import { useCanvasInteractions } from './useCanvasInteractions'
import type { PanState } from './canvas-interactions/canvas-interaction-types'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

const cutLineType: LineType = {
  id: 'cut',
  name: 'Cut',
  role: 'cut',
  style: 'solid',
  color: '#111827',
  visible: true,
}

const initialLine: Shape = {
  id: 'trim-line',
  type: 'line',
  layerId: 'layer',
  lineTypeId: 'cut',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
}

const containedLine: Shape = {
  id: 'contained-line',
  type: 'line',
  layerId: 'layer',
  lineTypeId: 'cut',
  start: { x: 0, y: 0 },
  end: { x: 2, y: 0 },
}

const crossingLine: Shape = {
  id: 'crossing-line',
  type: 'line',
  layerId: 'layer',
  lineTypeId: 'cut',
  start: { x: 4, y: 0 },
  end: { x: 8, y: 0 },
}

function dispatchPointer(node: Element, type: string, init: PointerEventInit) {
  const PointerEventCtor = window.PointerEvent ?? window.MouseEvent
  act(() => {
    node.dispatchEvent(
      new PointerEventCtor(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 0,
        clientY: 0,
        ...init,
      }),
    )
  })
}

function ToolStateProbe() {
  const state = useEditorToolSelector((toolState) => ({
    cadCommandMode: toolState.cadCommandMode,
    commandPreviewShapes: toolState.commandPreviewShapes,
  }))
  return createElement('output', { 'data-testid': 'tool-state' }, JSON.stringify(state))
}

type HarnessProps = {
  initialShapes?: Shape[]
  initialSelectedShapeIds?: string[]
}

function Harness({
  initialShapes = [initialLine],
  initialSelectedShapeIds = ['trim-line'],
}: HarnessProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const [shapes, setShapes] = useState<Shape[]>(initialShapes)
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>(initialSelectedShapeIds)
  const shapesById = useMemo(() => Object.fromEntries(shapes.map((shape) => [shape.id, shape])), [shapes])
  const interactions = useCanvasInteractions({
    svgRef,
    panRef,
    viewport: { x: 0, y: 0, scale: 1 },
    activeLayerId: 'layer',
    activeLineTypeId: 'cut',
    activeSketchGroup: null,
    snapSettings: { ...DEFAULT_SNAP_SETTINGS, enabled: false },
    foldLines: [],
    displayShapes: shapes,
    snapShapes: shapes,
    customSnapPoint: null,
    stitchTargetShapes: shapes,
    visibleHardwareMarkers: [],
    lineTypesById: { cut: cutLineType },
    shapesById,
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false }],
    stitchHoles: [],
    patternPieces: [],
    pieceNotches: [],
    seamConnections: [],
    hardwareMarkers: [],
    selectedShapeIds,
    selectedStitchHoleId: null,
    selectedHardwareMarkerId: null,
    setViewport: () => undefined,
    setShapes,
    setStitchHoles: () => undefined,
    setSelectedStitchHoleId: () => undefined,
    setPieceNotches: () => undefined,
    setSeamConnections: () => undefined,
    setHardwareMarkers: () => undefined,
    setSelectedHardwareMarkerId: () => undefined,
    setFoldLines: () => undefined,
    setDimensionLines: () => undefined,
    setSelectedShapeIds,
    ensureActiveLayerWritable: () => true,
    ensureActiveLineTypeWritable: () => true,
  })

  useEffect(() => {
    if (!svgRef.current) return
    Object.defineProperty(svgRef.current, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }),
    })
  }, [])

  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => interactions.runPrecisionCommand('trim') }, 'Trim'),
    createElement('button', { type: 'button', onClick: () => interactions.runPrecisionCommand('finish') }, 'Finish'),
    createElement('svg', {
      ref: svgRef,
      'data-testid': 'canvas',
      onPointerDown: interactions.handlePointerDown,
      onPointerMove: interactions.handlePointerMove,
      onPointerUp: interactions.handlePointerUp,
    }),
    createElement('output', { 'data-testid': 'shapes' }, JSON.stringify(shapes)),
    createElement('output', { 'data-testid': 'selected' }, JSON.stringify(selectedShapeIds)),
    createElement('output', { 'data-testid': 'interaction-preview' }, JSON.stringify(interactions.interactionPreview)),
    createElement(ToolStateProbe),
  )
}

function renderHarness(props?: HarnessProps) {
  lastRender = renderForTest(
    createElement(
      EditorUIStateProvider,
      null,
      createElement(
        EditorPanelStateProvider,
        null,
        createElement(EditorToolStateProvider, null, createElement(Harness, props)),
      ),
    ),
  )
  return lastRender
}

function readJson<T>(container: ParentNode, testId: string): T {
  return JSON.parse(container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? 'null') as T
}

describe('useCanvasInteractions CAD command mode', () => {
  it('previews, commits, and clears a trim command through pointer events', () => {
    const rendered = renderHarness()
    const canvas = rendered.container.querySelector('[data-testid="canvas"]')

    click(rendered.container.querySelector('button'))
    dispatchPointer(canvas!, 'pointermove', { clientX: 6, clientY: 0 })

    const previewState = readJson<{ cadCommandMode: string | null; commandPreviewShapes: Shape[] }>(rendered.container, 'tool-state')
    expect(previewState.cadCommandMode).toBe('trim')
    expect(previewState.commandPreviewShapes).toHaveLength(1)
    expect(previewState.commandPreviewShapes[0].start.x).toBe(0)
    expect(previewState.commandPreviewShapes[0].end.x).toBe(6)

    dispatchPointer(canvas!, 'pointerdown', { clientX: 6, clientY: 0 })

    const shapes = readJson<Shape[]>(rendered.container, 'shapes')
    const selected = readJson<string[]>(rendered.container, 'selected')
    const committedState = readJson<{ cadCommandMode: string | null; commandPreviewShapes: Shape[] }>(rendered.container, 'tool-state')
    expect(shapes[0].start.x).toBe(0)
    expect(shapes[0].end.x).toBe(6)
    expect(selected).toEqual(['trim-line'])
    expect(committedState.cadCommandMode).toBeNull()
    expect(committedState.commandPreviewShapes).toEqual([])

    click(rendered.container.querySelectorAll('button')[1])
    const clearedState = readJson<{ cadCommandMode: string | null; commandPreviewShapes: Shape[] }>(rendered.container, 'tool-state')
    expect(clearedState.cadCommandMode).toBeNull()
    expect(clearedState.commandPreviewShapes).toEqual([])
  })
})

describe('useCanvasInteractions CAD selection box', () => {
  it('selects only fully contained shapes for left-to-right drags', () => {
    const rendered = renderHarness({
      initialShapes: [containedLine, crossingLine],
      initialSelectedShapeIds: [],
    })
    const canvas = rendered.container.querySelector('[data-testid="canvas"]')

    dispatchPointer(canvas!, 'pointerdown', { clientX: -1, clientY: -1 })
    dispatchPointer(canvas!, 'pointermove', { clientX: 3, clientY: 1 })

    const preview = readJson<{ kind: string; mode: string }>(rendered.container, 'interaction-preview')
    expect(preview.kind).toBe('selection-box')
    expect(preview.mode).toBe('contained')

    dispatchPointer(canvas!, 'pointerup', { clientX: 3, clientY: 1 })

    expect(readJson<string[]>(rendered.container, 'selected')).toEqual(['contained-line'])
  })

  it('selects crossing shapes for right-to-left drags', () => {
    const rendered = renderHarness({
      initialShapes: [containedLine, crossingLine],
      initialSelectedShapeIds: [],
    })
    const canvas = rendered.container.querySelector('[data-testid="canvas"]')

    dispatchPointer(canvas!, 'pointerdown', { clientX: 6, clientY: -1 })
    dispatchPointer(canvas!, 'pointermove', { clientX: 1, clientY: 1 })

    const preview = readJson<{ kind: string; mode: string }>(rendered.container, 'interaction-preview')
    expect(preview.kind).toBe('selection-box')
    expect(preview.mode).toBe('crossing')

    dispatchPointer(canvas!, 'pointerup', { clientX: 1, clientY: 1 })

    expect(readJson<string[]>(rendered.container, 'selected')).toEqual(['contained-line', 'crossing-line'])
  })
})
