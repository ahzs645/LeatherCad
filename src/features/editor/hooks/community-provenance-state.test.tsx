import { act, createElement, useLayoutEffect, useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DocFile, Viewport } from '../cad/cad-types'
import { parseImportedJsonDocument } from '../editor-json-import'
import { EditorStateProviders } from '../state/providers/EditorStateProviders'
import { useEditorDocumentState } from './useEditorDocumentState'
import { useEditorLayers } from './useEditorLayers'
import { useEditorTools } from './useEditorTools'
import { useEditorUIState } from './useEditorUIState'
import { useEditorSelectionState } from './useEditorSelectionState'
import { useEditorPanelState } from './useEditorPanelState'
import { useLoadedDocumentActions } from './useLoadedDocumentActions'
import { useEditorDerivedState } from './useEditorDerivedState'
import { useEditorStateActions } from './useEditorStateActions'
import { useHistoryActions } from './useHistoryActions'
import { useEditorDocumentCommands } from '../useEditorDocumentCommands'
import { useEditorHistoryActions } from '../state/providers/EditorHistoryStateProvider'
import { cleanupRender, renderForTest } from '../../../test/render'
import { DEFAULT_MANUFACTURING_SETTINGS } from '../io/manufacturing/manufacturing-settings'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })

function useHarnessApi() {
  const doc = useEditorDocumentState(), layer = useEditorLayers(), ui = useEditorUIState()
  const tool = useEditorTools(), selection = useEditorSelectionState(), panel = useEditorPanelState()
  const [, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const common = { ...doc, ...layer, ...ui, ...tool, ...selection, ...panel, setViewport, svgRef }
  const loaded = useLoadedDocumentActions(common)
  const derived = useEditorDerivedState({ templateRepository: [], selectedTemplateEntryId: null, themeMode: 'dark' })
  const actions = useEditorStateActions({ ...common, activeLayer: derived.activeLayer, activeSketchGroup: derived.activeSketchGroup, activeLineType: derived.activeLineType })
  const history = useHistoryActions({ currentSnapshot: derived.currentSnapshot, applyEditorSnapshot: actions.applyEditorSnapshot })
  const historyState = useEditorHistoryActions()
  const commands = useEditorDocumentCommands({ ...common, selectedShapeIdSet: new Set<string>(), selectedEditableShape: null, selectedStitchHole: null })
  return { doc, loaded, derived, actions, history, historyState, commands, selection }
}

describe('structured community attribution in the actual editor hooks', () => {
  it('preserves manufacturing and protected nested shapes through save, reopen and history', () => {
    let api!: ReturnType<typeof useHarnessApi>
    function Harness() {
      const current = useHarnessApi()
      useLayoutEffect(() => { api = current }, [current])
      return null
    }
    rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
    const manufacturing = { ...DEFAULT_MANUFACTURING_SETTINGS, mode: 'jig' as const, jigStitchThrough: true, fingerHoles: [{ id: 'finger', x: 10, y: 10, diameterMm: 8 }] }
    const imported = parseImportedJsonDocument(JSON.stringify({
      objects: [{ id: 'protected', type: 'line', layerId: 'main', lineTypeId: 'cut', groupId: 'child', start: { x: 0, y: 0 }, end: { x: 20, y: 0 }, locked: true, opacity: 0.4 }],
      layers: [{ id: 'main', name: 'Main', visible: true, locked: false }],
      lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', visible: true, color: '#111111' }],
      sketchGroups: [{ id: 'parent', name: 'Parent', layerId: 'main', visible: false, locked: true }, { id: 'child', name: 'Child', layerId: 'main', visible: true, locked: false, parentId: 'parent' }], manufacturing,
    })).doc
    act(() => { api.loaded.applyLoadedDocument(imported, 'Loaded jig'); api.selection.setSelectedShapeIds(['protected']) })
    expect(api.derived.visibleShapes).toHaveLength(0)
    expect(api.derived.selectedShapeIdSet.size).toBe(0)
    act(() => api.doc.setShapes(previous => previous.map(shape => ({ ...shape, opacity: 1 }))))
    expect(api.doc.shapes[0].opacity).toBe(0.4)
    const saved = api.commands.buildCurrentDocFile()
    expect(saved.manufacturing).toEqual(manufacturing)
    const reopened = parseImportedJsonDocument(JSON.stringify(saved)).doc
    expect(reopened.objects[0]).toMatchObject({ locked: true, opacity: 0.4 })
    expect(reopened.sketchGroups?.[1].parentId).toBe('parent')
    const snapshot = api.derived.currentSnapshot
    expect(snapshot.manufacturing).toEqual(manufacturing)
    expect(snapshot.manufacturing).not.toBe(api.doc.manufacturing)
    act(() => { api.historyState.setHistoryState({ past: [snapshot], future: [] }); api.actions.resetDocument() })
    expect(api.commands.buildCurrentDocFile().manufacturing).toBeUndefined()
    act(() => api.history.handleUndo())
    expect(api.commands.buildCurrentDocFile().manufacturing).toEqual(manufacturing)
    expect(api.doc.shapes[0]).toMatchObject({ locked: true, opacity: 0.4 })
    act(() => api.history.handleRedo())
    expect(api.commands.buildCurrentDocFile().manufacturing).toBeUndefined()
  })
  it('survives load, document build, JSON reopen and undo/redo; new documents clear it', () => {
    let api!: ReturnType<typeof useHarnessApi>
    function Harness() {
      const current = useHarnessApi()
      useLayoutEffect(() => { api = current })
      return createElement('div')
    }
    rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
    const source: NonNullable<DocFile['communityProvenance']> = [{ kind: 'community-pattern', patternId: 'original-pattern', version: 2, title: 'Wallet', author: 'Maker', license: 'CC-BY-NC-4.0', attribution: 'Original source credit '.repeat(500) }]
    const imported = parseImportedJsonDocument(JSON.stringify({ documentName: 'Attributed copy', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], communityProvenance: source })).doc
    act(() => api.loaded.applyLoadedDocument(imported, 'Loaded attributed copy'))
    expect(api.doc.communityProvenance).toEqual(source)
    const saved = api.commands.buildCurrentDocFile()
    expect(saved.communityProvenance).toEqual(source)
    expect(parseImportedJsonDocument(JSON.stringify(saved)).doc.communityProvenance).toEqual(source)
    const snapshot = api.derived.currentSnapshot
    expect(snapshot.communityProvenance).toEqual(source)
    expect(snapshot.communityProvenance).not.toBe(api.doc.communityProvenance)
    act(() => {
      api.historyState.setHistoryState({ past: [snapshot], future: [] })
      api.actions.resetDocument()
    })
    expect(api.commands.buildCurrentDocFile().communityProvenance).toEqual([])
    act(() => api.history.handleUndo())
    expect(api.commands.buildCurrentDocFile().communityProvenance).toEqual(source)
    act(() => api.history.handleRedo())
    expect(api.commands.buildCurrentDocFile().communityProvenance).toEqual([])
    act(() => api.loaded.applyLoadedDocument(saved, 'Reopened attributed copy'))
    expect(api.commands.buildCurrentDocFile().communityProvenance).toEqual(source)
  })
})
