import { act, createElement, useLayoutEffect, type ComponentProps } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { changeValue, cleanupRender, click, renderForTest } from '../../../test/render'
import { EDITOR_LANGUAGES, getBuiltinTranslation } from '../ops/locale-dictionaries'
import { setEditorLocale } from '../ops/locale-store'
import { RECOVERY_ACTION_KEYS, RECOVERY_DECISION_KEY, RECOVERY_DICTIONARIES, RECOVERY_TRANSFER_KEY } from '../ops/locale-recovery'
import { CALIBRATION_ACTION_KEYS, SPECIALIST_CONTROL_KEYS } from '../ops/locale-specialist-controls'
import { NATIVE_EDITOR_ALIASES, NATIVE_EDITOR_KEYS, NATIVE_EDITOR_VALIDATION_KEYS } from '../ops/locale-native-editor'
import { saveTranslationMap } from '../ops/translation-ops'
import { DEFAULT_MANUFACTURING_SETTINGS } from '../io/manufacturing/manufacturing-settings'
import { buildPrintPlan } from '../preview/print-preview'
import { DraftRecoveryDialog } from './DraftRecoveryDialog'
import { PrintPreviewModal } from './PrintPreviewModal'
import { StlManufacturingControls } from './StlManufacturingControls'
import { EditorStateProviders } from '../state/providers/EditorStateProviders'
import { useEditorDocumentStateApi } from '../state/providers/EditorDocumentStateProvider'
import { NativeCurveInspectorControls } from '../workbench/NativeCurveInspectorControls'
import { ShapeAppearanceControls } from '../workbench/ShapeAppearanceControls'
import { parseImportedJsonDocument } from '../editor-json-import'
import { StlExportModal } from './StlExportModal'

vi.mock('../hooks/useStlGeneration', () => ({ useStlGeneration: () => ({ result: null, error: '', pending: true, faces: [] }) }))

let rendered: ReturnType<typeof renderForTest> | null = null
beforeEach(() => { setEditorLocale('en'); saveTranslationMap({}) })
afterEach(() => { cleanupRender(rendered); rendered = null; setEditorLocale('en'); saveTranslationMap({}) })
const noop = () => undefined
function printProps(): ComponentProps<typeof PrintPreviewModal> {
  return {
    open: true, onClose: noop, printPaper: 'letter', onSetPrintPaper: noop, printOrientation: 'portrait', onSetPrintOrientation: noop,
    printIntoMargin: false, onSetPrintIntoMargin: noop, printScalePercent: 100, onSetPrintScalePercent: noop,
    printCalibrationXPercent: 100, onSetPrintCalibrationXPercent: noop, printCalibrationYPercent: 100, onSetPrintCalibrationYPercent: noop,
    printTileX: 1, onSetPrintTileX: noop, printTileY: 1, onSetPrintTileY: noop, printOverlapMm: 4, onSetPrintOverlapMm: noop,
    printMarginMm: 8, onSetPrintMarginMm: noop, printSelectedOnly: false, onSetPrintSelectedOnly: noop, printRulerInside: true,
    onSetPrintRulerInside: noop, printRulerAnchorTileIndex: null, onSetPrintRulerAnchorTileIndex: noop, printInColor: true,
    onSetPrintInColor: noop, printStitchAsDots: false, onSetPrintStitchAsDots: noop, printLineThicknessScalePercent: 100,
    onSetPrintLineThicknessScalePercent: noop, printShowIgnoredLineTypes: false, onSetPrintShowIgnoredLineTypes: noop,
    printPlan: null, showPrintAreas: false, onTogglePrintAreas: noop, onFitView: noop, onOpenPrintTiles: noop,
  }
}

it('covers every recovery decision/action, native editor field and shared specialist control in all supported non-English locales', () => {
  for (const { locale } of EDITOR_LANGUAGES.filter(language => language.locale !== 'en')) {
    for (const key of [...RECOVERY_ACTION_KEYS, RECOVERY_DECISION_KEY, RECOVERY_TRANSFER_KEY, ...SPECIALIST_CONTROL_KEYS, ...CALIBRATION_ACTION_KEYS, ...NATIVE_EDITOR_KEYS, ...Object.keys(NATIVE_EDITOR_ALIASES), ...NATIVE_EDITOR_VALIDATION_KEYS]) {
      expect(getBuiltinTranslation(locale, key)?.trim(), `${locale}: ${key}`).toBeTruthy()
    }
  }
})

it('switches the mounted native inspector in every locale, retains user group names and edits canonical geometry', () => {
  let doc!: ReturnType<typeof useEditorDocumentStateApi>
  function Harness() {
    doc = useEditorDocumentStateApi()
    const { setShapes, setSketchGroups } = doc
    useLayoutEffect(() => {
      setSketchGroups([{ id: 'group', name: 'My English group', layerId: 'layer', visible: true, locked: false }])
      setShapes([{ id: 'ellipse', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', groupId: 'group', center: { x: 0, y: 0 }, radiusX: 25.4, radiusY: 12.7, rotationDeg: 30, startAngleDeg: 0, sweepDeg: 360 }])
    }, [setShapes, setSketchGroups])
    const shape = doc.shapes[0]
    return shape?.type === 'ellipse' ? createElement('div', null, createElement(NativeCurveInspectorControls, { shape }), createElement(ShapeAppearanceControls, { shape })) : null
  }
  rendered = renderForTest(createElement(EditorStateProviders, null, createElement(Harness)))
  const original = JSON.stringify({ shapes: doc.shapes, groups: doc.sketchGroups })
  for (const { locale } of EDITOR_LANGUAGES.filter(language => language.locale !== 'en')) {
    act(() => setEditorLocale(locale))
    expect(rendered.container.textContent).toContain(getBuiltinTranslation(locale, 'curve.radiusX'))
    expect(rendered.container.textContent).toContain(getBuiltinTranslation(locale, 'shape.appearance'))
    expect(rendered.container.querySelector(`input[aria-label="${getBuiltinTranslation(locale, 'curve.center')} X (mm)"]`)).not.toBeNull()
    expect(doc.sketchGroups[0].name).toBe('My English group')
    expect(JSON.stringify({ shapes: doc.shapes, groups: doc.sketchGroups })).toBe(original)
  }
  act(() => setEditorLocale('de'))
  changeValue(rendered.container.querySelector('input[aria-label="Mittelpunkt X (mm)"]'), '42.5')
  click([...rendered.container.querySelectorAll('button')].find(button => button.textContent === getBuiltinTranslation('de', 'curve.apply'))!)
  expect(doc.shapes[0]).toMatchObject({ type: 'ellipse', center: { x: 42.5, y: 0 }, radiusX: 25.4, radiusY: 12.7 })
})

it('renders the actual recovery choices in every locale without changing draft contents', () => {
  const snapshot = { version: 1 as const, id: 'draft', savedAt: 1, reason: 'autosave' as const, localDocumentId: null, serializedDoc: '{"documentName":"Keep my English name"}' }
  const draft = { key: 'saved', raw: 'original bytes', snapshot }
  const original = JSON.stringify(draft)
  for (const { locale } of EDITOR_LANGUAGES.filter(language => language.locale !== 'en')) {
    setEditorLocale(locale)
    rendered = renderForTest(createElement(DraftRecoveryDialog, {
      loading: false, draft, drafts: [draft], selected: 0, onSelect: noop, error: '', busy: false, failure: '', canDismissFailure: true,
      onRetry: noop, explicitTransfer: true, onRecover: async () => {}, onDiscard: async () => {}, onDownloadDraft: noop, onDownloadCurrent: noop, onDismissFailure: noop,
    }))
    expect(rendered.container.querySelector('h2')?.textContent).toBe(RECOVERY_DICTIONARIES[locale]['Recover saved drawing'])
    expect(rendered.container.textContent).toContain(RECOVERY_DICTIONARIES[locale][RECOVERY_DECISION_KEY])
    expect(rendered.container.textContent).toContain(RECOVERY_DICTIONARIES[locale][RECOVERY_TRANSFER_KEY])
    expect(JSON.stringify(draft)).toBe(original)
    cleanupRender(rendered); rendered = null
  }
})

it('localizes live manufacturing controls and retains canonical settings and role values', () => {
  const settings = { ...structuredClone(DEFAULT_MANUFACTURING_SETTINGS), mode: 'jig' as const, jigWallHeightMm: 3.2 }
  const before = JSON.stringify(settings), change = vi.fn()
  setEditorLocale('de')
  rendered = renderForTest(createElement(StlManufacturingControls, { settings, onChange: change, faces: [] }))
  const label = [...rendered.container.querySelectorAll('label')].find(label => label.textContent?.includes('Taschentiefe (mm)'))!
  changeValue(label.querySelector('input'), '4.75')
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ mode: 'jig', jigWallHeightMm: 4.75, targetRoles: ['cut'] }))
  expect(JSON.stringify(settings)).toBe(before)
  act(() => { setEditorLocale('ja') })
  rendered.rerender(createElement(StlManufacturingControls, { settings, onChange: change, faces: [] }))
  expect(rendered.container.textContent).toContain('治具本体と穴')
  expect(rendered.container.textContent).toContain('ポケットの深さ (mm)')
})

it('translates the open manufacturing font error when the interface changes, retaining user document data', () => {
  const doc = parseImportedJsonDocument(JSON.stringify({ documentName: 'My English pattern', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
  doc.manufacturing = { ...structuredClone(DEFAULT_MANUFACTURING_SETTINGS), textEngrave: 'top' }
  const original = JSON.stringify(doc)
  setEditorLocale('ja')
  rendered = renderForTest(createElement(StlExportModal, { open: true, onClose: noop, doc }))
  const input = rendered.container.querySelector<HTMLInputElement>('input[type=file]')!
  expect(input.getAttribute('aria-label')).toBe('彫刻用フォント（.ttf/.otf）')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'My English font.ttf')] })
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(rendered.container.querySelector('[role=alert]')?.textContent).toBe('4 MB 以下の彫刻用フォントを選んでください。')
  act(() => setEditorLocale('en'))
  expect(rendered.container.querySelector('[role=alert]')?.textContent).toBe('Choose an engraving font no larger than 4 MB.')
  expect(JSON.stringify(doc)).toBe(original)
})

it('localizes print fields, clipping warnings and placeholder summaries while preserving paper IDs, numbers and imported overrides', () => {
  const props = printProps(), scale = vi.fn()
  const plan = buildPrintPlan([{ id: 'line', type: 'line', layerId: 'L', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 500, y: 20 } }], { paper: 'letter', marginMm: 8, overlapMm: 4, tileX: 1, tileY: 1, scalePercent: 100 })!
  const original = JSON.stringify(plan)
  setEditorLocale('de')
  rendered = renderForTest(createElement(PrintPreviewModal, { ...props, printPlan: plan, onSetPrintScalePercent: scale }))
  expect(rendered.container.querySelector('h2')?.textContent).toBe('Druckvorschau und Seitenaufteilung')
  const label = [...rendered.container.querySelectorAll('label')].find(label => label.textContent?.includes('Maßstab (%)'))!
  changeValue(label.querySelector('input'), '125')
  expect(scale).toHaveBeenCalledExactlyOnceWith(125)
  expect(rendered.container.querySelector('select')?.value).toBe('letter')
  act(() => { setEditorLocale('ja'); saveTranslationMap({ 'print.pages': 'IMPORTED {count}', Paper: 'CUSTOM PAPER' }) })
  rendered.rerender(createElement(PrintPreviewModal, { ...props, printPlan: plan }))
  expect(rendered.container.textContent).toContain('IMPORTED 1')
  expect(rendered.container.textContent).toContain('CUSTOM PAPER')
  expect(rendered.container.querySelector('[role=status]')?.textContent).toContain('分割ページ数を増やしてください')
  expect(rendered.container.textContent).not.toMatch(/\{(?:count|width|height|percent|visibility)\}/)
  expect(JSON.stringify(plan)).toBe(original)
})

it('uses calibrated axis scales for clipping and shows orientation-adjusted DPI', () => {
  const shapes = [{ id: 'line', type: 'line' as const, layerId: 'L', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 240, y: 20 } }]
  const base = { paper: 'letter' as const, marginMm: 8, overlapMm: 4, tileX: 1, tileY: 1, scalePercent: 100, calibrationXPercent: 50, calibrationYPercent: 100 }
  const props = { ...printProps(), printCalibrationXPercent: 50, printPlan: buildPrintPlan(shapes, base) }
  rendered = renderForTest(createElement(PrintPreviewModal, props))
  expect(rendered.container.querySelector('[role=status]')).toBeNull()
  expect(rendered.container.textContent).toContain('Active DPI: 48 × 96')
  rendered.rerender(createElement(PrintPreviewModal, { ...props, printOrientation: 'landscape', printCalibrationYPercent: 200, printPlan: buildPrintPlan(shapes, { ...base, orientation: 'landscape', calibrationYPercent: 200 }) }))
  expect(rendered.container.querySelector('[role=status]')?.textContent).toContain('Increase the tile count')
  expect(rendered.container.textContent).toContain('Active DPI: 192 × 48')
})
