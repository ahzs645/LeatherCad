import { act, createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { EditorStateProviders } from '../state/providers/EditorStateProviders'
import { useExportActions } from './useExportActions'
import { downloadFile } from '../editor-utils'
import type { DocumentTransferReview } from '../components/DocumentTransferReviewModal'
import type { LineShape, LineType } from '../cad/cad-types'

vi.mock('../editor-utils', async importOriginal => ({ ...await importOriginal<typeof import('../editor-utils')>(), downloadFile: vi.fn() }))
let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null; vi.clearAllMocks() })

function setup() {
  let actions!: ReturnType<typeof useExportActions>, review: DocumentTransferReview | undefined
  let changeSession!: (value: number) => void
  const line: LineShape = { id: 'line', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 20, y: 10 }, opacity: 0.4 }
  const lineType: LineType = { id: 'cut', name: 'Cut', color: '#111111', role: 'cut', style: 'solid', visible: true }
  function Harness() {
    const [session, setSession] = useState(0)
    changeSession = setSession
    actions = useExportActions({ documentSessionKey: session, onReviewExport: value => { review = value },
      shapes: [line], foldLines: [], stitchHoles: [], lineTypes: [lineType], lineTypesById: { cut: lineType }, patternPiecesById: {}, lineTypeStylesById: { cut: 'solid' }, sketchGroupsById: {}, selectedShapeIdSet: new Set(), visibleLayerIdSet: new Set(['layer']), showAnnotations: false, annotationLabels: [], pieceGrainlineSegments: [], pieceNotchLines: [], piecePlacementGuides: [], stitchAlwaysShapeIdSet: new Set(), exportUnit: 'mm',
    })
    return null
  }
  rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
  return { getActions: () => actions, getReview: () => review, changeSession: (value: number) => changeSession(value) }
}

describe('DXF loss review', () => {
  it('shows real encoder losses before downloading and requires the explicit action', async () => {
    const api = setup()
    act(() => api.getActions().handleExportDxf())
    await vi.waitFor(() => expect(api.getReview()).toBeDefined())
    expect(downloadFile).not.toHaveBeenCalled()
    expect(api.getReview()?.warnings.join(' ')).toMatch(/opacity/i)
    act(() => api.getReview()?.onApply())
    expect(downloadFile).toHaveBeenCalledWith('leathercraft-export.dxf', expect.stringContaining('ENTITIES'), 'application/dxf')
  })

  it('rejects a previous document export when the document is replaced during review', async () => {
    const api = setup()
    act(() => api.getActions().handleExportDxf())
    await vi.waitFor(() => expect(api.getReview()).toBeDefined())
    const previous = api.getReview()
    act(() => api.changeSession(1))
    act(() => previous?.onApply())
    expect(downloadFile).not.toHaveBeenCalled()
  })
})
