import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  WheelEvent as ReactWheelEvent,
} from 'react'
import './App.css'
import {
  arcPath,
  clamp,
  distance,
  getBounds,
  isPointLike,
  isShapeLike,
  round,
  uid,
} from './cad-geometry'
import type {
  DocFile,
  FoldLine,
  Layer,
  LineType,
  LineTypeRole,
  Point,
  Shape,
  StitchHole,
  StitchHoleType,
  TracingOverlay,
  Tool,
  Viewport,
} from './cad-types'
import { LineTypePalette } from './components/LineTypePalette'
import { StitchHolePanel } from './components/StitchHolePanel'
import { ThreePreviewPanel } from './components/ThreePreviewPanel'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
  lineTypeStrokeDasharray,
  normalizeLineTypes,
  parseLineType,
  resolveActiveLineTypeId,
  resolveShapeLineTypeId,
} from './line-types'
import { applyLineTypeToShapeIds, countShapesByLineType } from './line-type-ops'
import {
  countStitchHolesByShape,
  createStitchHole,
  deleteStitchHolesForShapes,
  fixStitchHoleOrderFromHole,
  findNearestStitchAnchor,
  generateFixedPitchStitchHoles,
  generateVariablePitchStitchHoles,
  normalizeStitchHoleSequences,
  parseStitchHole,
  resequenceStitchHolesOnShape,
  selectNextStitchHole,
} from './stitch-hole-ops'
import { importSvgAsShapes } from './io-svg'
import { buildDxfFromShapes } from './io-dxf'
import { DEFAULT_PRESET_ID, PRESET_DOCS } from './sample-doc'
import { applyRedo, applyUndo, deepClone, pushHistorySnapshot, type HistoryState } from './history-ops'
import { buildPrintPlan, type PrintPaper } from './print-preview'
import {
  createTemplateFromDoc,
  insertTemplateDocIntoCurrent,
  loadTemplateRepository,
  parseTemplateRepositoryImport,
  saveTemplateRepository,
  serializeTemplateRepository,
  type TemplateRepositoryEntry,
} from './template-repository'
import {
  copySelectionToClipboard,
  moveSelectionByOneStep,
  moveSelectionToEdge,
  pasteClipboardPayload,
  type ClipboardPayload,
} from './shape-selection-ops'

const GRID_STEP = 100
const GRID_EXTENT = 4000
const MIN_ZOOM = 0.2
const MAX_ZOOM = 6
const MOBILE_MEDIA_QUERY = '(max-width: 1100px)'
const DEFAULT_FRONT_LAYER_COLOR = '#60a5fa'
const DEFAULT_BACK_LAYER_COLOR = '#f97316'
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const STITCH_COLOR_DARK = '#f59e0b'
const STITCH_COLOR_LIGHT = '#b45309'
const FOLD_COLOR_DARK = '#ef4444'
const FOLD_COLOR_LIGHT = '#dc2626'

type MobileViewMode = 'editor' | 'preview' | 'split'
type MobileOptionsTab = 'view' | 'layers' | 'file'
type ThemeMode = 'dark' | 'light'
type LegendMode = 'layer' | 'stack'
type DxfVersion = 'r12' | 'r14'
type ExportRoleFilters = Record<LineTypeRole, boolean>
type MobileLayerAction =
  | 'add'
  | 'rename'
  | 'toggle-visibility'
  | 'toggle-lock'
  | 'move-up'
  | 'move-down'
  | 'delete'
  | 'colors'
type MobileFileAction =
  | 'save-json'
  | 'load-json'
  | 'import-svg'
  | 'load-preset'
  | 'export-svg'
  | 'export-dxf'
  | 'export-options'
  | 'template-repository'
  | 'import-tracing'
  | 'print-preview'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'toggle-3d'
  | 'clear'

type EditorSnapshot = {
  layers: Layer[]
  activeLayerId: string
  lineTypes: LineType[]
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  tracingOverlays: TracingOverlay[]
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
}

const DEFAULT_EXPORT_ROLE_FILTERS: ExportRoleFilters = {
  cut: true,
  stitch: true,
  fold: true,
  guide: true,
  mark: true,
}

const HISTORY_LIMIT = 120
const CLIPBOARD_PASTE_OFFSET = 12

const TOOL_OPTIONS: Array<{ value: Tool; label: string }> = [
  { value: 'pan', label: 'Move' },
  { value: 'line', label: 'Line' },
  { value: 'arc', label: 'Arc' },
  { value: 'bezier', label: 'Bezier' },
  { value: 'fold', label: 'Fold' },
  { value: 'stitch-hole', label: 'Stitch Hole' },
]

const MOBILE_OPTIONS_TABS: Array<{ value: MobileOptionsTab; label: string }> = [
  { value: 'view', label: 'View' },
  { value: 'layers', label: 'Layers' },
  { value: 'file', label: 'File' },
]

function toolLabel(tool: Tool) {
  return TOOL_OPTIONS.find((entry) => entry.value === tool)?.label ?? tool
}

function channelToHex(value: number) {
  const clamped = clamp(Math.round(value), 0, 255)
  return clamped.toString(16).padStart(2, '0')
}

function normalizeHexColor(value: string, fallback: string) {
  const candidate = value.trim()
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase()
  }
  return fallback
}

function interpolateHexColor(startHex: string, endHex: string, ratio: number) {
  const clampedRatio = clamp(ratio, 0, 1)
  const parseChannel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16)

  const start = normalizeHexColor(startHex, DEFAULT_FRONT_LAYER_COLOR)
  const end = normalizeHexColor(endHex, DEFAULT_BACK_LAYER_COLOR)

  const red = parseChannel(start, 1) + (parseChannel(end, 1) - parseChannel(start, 1)) * clampedRatio
  const green = parseChannel(start, 3) + (parseChannel(end, 3) - parseChannel(start, 3)) * clampedRatio
  const blue = parseChannel(start, 5) + (parseChannel(end, 5) - parseChannel(start, 5)) * clampedRatio

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function parseFoldLine(value: unknown): FoldLine | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    start?: unknown
    end?: unknown
    angleDeg?: unknown
    maxAngleDeg?: unknown
  }

  if (!isPointLike(candidate.start) || !isPointLike(candidate.end)) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Fold',
    start: candidate.start,
    end: candidate.end,
    angleDeg: typeof candidate.angleDeg === 'number' ? clamp(candidate.angleDeg, 0, 180) : 0,
    maxAngleDeg: typeof candidate.maxAngleDeg === 'number' ? clamp(candidate.maxAngleDeg, 10, 180) : 180,
  }
}

function parseLayer(value: unknown): Layer | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    visible?: unknown
    locked?: unknown
    stackLevel?: unknown
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Layer',
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : false,
    stackLevel:
      typeof candidate.stackLevel === 'number' && Number.isFinite(candidate.stackLevel)
        ? Math.max(0, Math.round(candidate.stackLevel))
        : undefined,
  }
}

function parseTracingOverlay(value: unknown): TracingOverlay | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<TracingOverlay>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return null
  }
  if (candidate.kind !== 'image' && candidate.kind !== 'pdf') {
    return null
  }
  if (typeof candidate.sourceUrl !== 'string' || candidate.sourceUrl.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    kind: candidate.kind,
    sourceUrl: candidate.sourceUrl,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : true,
    opacity: typeof candidate.opacity === 'number' ? clamp(candidate.opacity, 0.05, 1) : 0.75,
    scale: typeof candidate.scale === 'number' ? clamp(candidate.scale, 0.05, 20) : 1,
    rotationDeg: typeof candidate.rotationDeg === 'number' ? candidate.rotationDeg : 0,
    offsetX: typeof candidate.offsetX === 'number' ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' ? candidate.offsetY : 0,
    width: typeof candidate.width === 'number' && candidate.width > 0 ? candidate.width : 800,
    height: typeof candidate.height === 'number' && candidate.height > 0 ? candidate.height : 800,
    isObjectUrl: false,
  }
}

function newLayerName(index: number) {
  return `Layer ${index + 1}`
}

function createDefaultLayer(id: string): Layer {
  return {
    id,
    name: 'Layer 1',
    visible: true,
    locked: false,
    stackLevel: 0,
  }
}

function buildDocSnapshotSignature(snapshot: EditorSnapshot) {
  return JSON.stringify(snapshot)
}

function App() {
  const initialLayerIdRef = useRef(uid())
  const [lineTypes, setLineTypes] = useState<LineType[]>(() => createDefaultLineTypes())
  const [activeLineTypeId, setActiveLineTypeId] = useState(DEFAULT_ACTIVE_LINE_TYPE_ID)
  const [stitchHoleType, setStitchHoleType] = useState<StitchHoleType>('round')
  const [stitchPitchMm, setStitchPitchMm] = useState(4)
  const [stitchVariablePitchStartMm, setStitchVariablePitchStartMm] = useState(3)
  const [stitchVariablePitchEndMm, setStitchVariablePitchEndMm] = useState(5)
  const [showStitchSequenceLabels, setShowStitchSequenceLabels] = useState(false)
  const [tool, setTool] = useState<Tool>('pan')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [foldLines, setFoldLines] = useState<FoldLine[]>([])
  const [stitchHoles, setStitchHoles] = useState<StitchHole[]>([])
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerIdRef.current,
      name: 'Layer 1',
      visible: true,
      locked: false,
      stackLevel: 0,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerIdRef.current)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [status, setStatus] = useState('Ready')
  const [isPanning, setIsPanning] = useState(false)
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [showLayerColorModal, setShowLayerColorModal] = useState(false)
  const [showLineTypePalette, setShowLineTypePalette] = useState(false)
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false)
  const [exportOnlyVisibleLineTypes, setExportOnlyVisibleLineTypes] = useState(true)
  const [exportRoleFilters, setExportRoleFilters] = useState<ExportRoleFilters>({ ...DEFAULT_EXPORT_ROLE_FILTERS })
  const [exportForceSolidStrokes, setExportForceSolidStrokes] = useState(false)
  const [dxfFlipY, setDxfFlipY] = useState(false)
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('r12')
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [selectedStitchHoleId, setSelectedStitchHoleId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [showTracingModal, setShowTracingModal] = useState(false)
  const [templateRepository, setTemplateRepository] = useState<TemplateRepositoryEntry[]>(() => loadTemplateRepository())
  const [selectedTemplateEntryId, setSelectedTemplateEntryId] = useState<string | null>(null)
  const [showTemplateRepositoryModal, setShowTemplateRepositoryModal] = useState(false)
  const [printPaper, setPrintPaper] = useState<PrintPaper>('letter')
  const [printTileX, setPrintTileX] = useState(1)
  const [printTileY, setPrintTileY] = useState(1)
  const [printOverlapMm, setPrintOverlapMm] = useState(4)
  const [printMarginMm, setPrintMarginMm] = useState(8)
  const [printScalePercent, setPrintScalePercent] = useState(100)
  const [printSelectedOnly, setPrintSelectedOnly] = useState(false)
  const [printRulerInside, setPrintRulerInside] = useState(false)
  const [printInColor, setPrintInColor] = useState(true)
  const [printStitchAsDots, setPrintStitchAsDots] = useState(false)
  const [showPrintAreas, setShowPrintAreas] = useState(false)
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false)
  const [clipboardPayload, setClipboardPayload] = useState<ClipboardPayload | null>(null)
  const [historyState, setHistoryState] = useState<HistoryState<EditorSnapshot>>({ past: [], future: [] })
  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const svgInputRef = useRef<HTMLInputElement | null>(null)
  const tracingInputRef = useRef<HTMLInputElement | null>(null)
  const templateImportInputRef = useRef<HTMLInputElement | null>(null)
  const lastSnapshotRef = useRef<EditorSnapshot | null>(null)
  const lastSnapshotSignatureRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
  const pasteCountRef = useRef(0)
  const tracingObjectUrlsRef = useRef<Set<string>>(new Set())
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number; pointerId: number } | null>(
    null,
  )

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null, [layers, activeLayerId])
  const activeLineType = useMemo(
    () => lineTypes.find((lineType) => lineType.id === activeLineTypeId) ?? lineTypes[0] ?? null,
    [lineTypes, activeLineTypeId],
  )
  const lineTypesById = useMemo(
    () => Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType])),
    [lineTypes],
  )
  const shapesById = useMemo(
    () => Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
    [shapes],
  )
  const selectedShapeIdSet = useMemo(() => new Set(selectedShapeIds), [selectedShapeIds])
  const shapeCountsByLineType = useMemo(() => countShapesByLineType(shapes), [shapes])
  const stitchHoleCountsByShape = useMemo(() => countStitchHolesByShape(stitchHoles), [stitchHoles])
  const selectedShapeCount = selectedShapeIds.length
  const selectedStitchHoleCount = useMemo(
    () => selectedShapeIds.reduce((sum, shapeId) => sum + (stitchHoleCountsByShape[shapeId] ?? 0), 0),
    [selectedShapeIds, stitchHoleCountsByShape],
  )
  const selectedStitchHole = useMemo(
    () => stitchHoles.find((stitchHole) => stitchHole.id === selectedStitchHoleId) ?? null,
    [stitchHoles, selectedStitchHoleId],
  )
  const activeTracingOverlay = useMemo(
    () => tracingOverlays.find((overlay) => overlay.id === activeTracingOverlayId) ?? null,
    [tracingOverlays, activeTracingOverlayId],
  )
  const selectedTemplateEntry = useMemo(
    () => templateRepository.find((entry) => entry.id === selectedTemplateEntryId) ?? null,
    [templateRepository, selectedTemplateEntryId],
  )
  const canUndo = historyState.past.length > 0
  const canRedo = historyState.future.length > 0
  const visibleShapes = useMemo(() => {
    const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id))
    const visibleLineTypeIds = new Set(lineTypes.filter((lineType) => lineType.visible).map((lineType) => lineType.id))
    return shapes.filter((shape) => visibleLayerIds.has(shape.layerId) && visibleLineTypeIds.has(shape.lineTypeId))
  }, [layers, lineTypes, shapes])
  const visibleShapeIdSet = useMemo(() => new Set(visibleShapes.map((shape) => shape.id)), [visibleShapes])
  const visibleStitchHoles = useMemo(
    () =>
      stitchHoles.filter((stitchHole) => {
        const shape = shapesById[stitchHole.shapeId]
        if (!shape || !visibleShapeIdSet.has(shape.id)) {
          return false
        }
        const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
        return lineTypeRole === 'stitch'
      }),
    [stitchHoles, shapesById, visibleShapeIdSet, lineTypesById],
  )
  const visibleLayerIdSet = useMemo(() => new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id)), [layers])
  const lineTypeStylesById = useMemo(
    () =>
      Object.fromEntries(
        lineTypes.map((lineType) => [lineType.id, lineType.style] as const),
      ),
    [lineTypes],
  )
  const printableShapes = useMemo(() => {
    if (!printSelectedOnly) {
      return visibleShapes
    }
    return visibleShapes.filter((shape) => selectedShapeIdSet.has(shape.id))
  }, [printSelectedOnly, visibleShapes, selectedShapeIdSet])
  const printPlan = useMemo(
    () =>
      buildPrintPlan(printableShapes, {
        paper: printPaper,
        marginMm: printMarginMm,
        overlapMm: printOverlapMm,
        tileX: printTileX,
        tileY: printTileY,
        scalePercent: printScalePercent,
      }),
    [printableShapes, printPaper, printMarginMm, printOverlapMm, printTileX, printTileY, printScalePercent],
  )
  const activeExportRoleCount = useMemo(
    () => Object.values(exportRoleFilters).filter((value) => value).length,
    [exportRoleFilters],
  )
  const layerColorsById = useMemo(() => {
    const colorMap: Record<string, string> = {}
    const denominator = Math.max(layers.length - 1, 1)

    for (const [index, layer] of layers.entries()) {
      const continuumColor = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
      colorMap[layer.id] = layerColorOverrides[layer.id] ?? continuumColor
    }

    return colorMap
  }, [layers, frontLayerColor, backLayerColor, layerColorOverrides])
  const layerStackLevels = useMemo(() => {
    const stackMap: Record<string, number> = {}
    for (const [index, layer] of layers.entries()) {
      stackMap[layer.id] =
        typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
          ? Math.max(0, Math.round(layer.stackLevel))
          : index
    }
    return stackMap
  }, [layers])
  const stackColorsByLevel = useMemo(() => {
    const uniqueStackLevels = Array.from(new Set(layers.map((layer) => layerStackLevels[layer.id] ?? 0))).sort(
      (left, right) => left - right,
    )
    const denominator = Math.max(uniqueStackLevels.length - 1, 1)
    const colorMap: Record<number, string> = {}

    uniqueStackLevels.forEach((stackLevel, index) => {
      colorMap[stackLevel] = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
    })

    return colorMap
  }, [layers, layerStackLevels, frontLayerColor, backLayerColor])
  const stackColorsByLayerId = useMemo(() => {
    const colorMap: Record<string, string> = {}
    for (const [index, layer] of layers.entries()) {
      const stackLevel = layerStackLevels[layer.id] ?? index
      colorMap[layer.id] = stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR
    }
    return colorMap
  }, [layers, layerStackLevels, stackColorsByLevel])
  const stackLegendEntries = useMemo(() => {
    const grouped = new Map<number, string[]>()
    for (const layer of layers) {
      const stackLevel = layerStackLevels[layer.id] ?? 0
      const names = grouped.get(stackLevel) ?? []
      names.push(layer.name)
      grouped.set(stackLevel, names)
    }

    return Array.from(grouped.entries())
      .map(([stackLevel, layerNames]) => ({
        stackLevel,
        layerNames,
        color: stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR,
      }))
      .sort((left, right) => left.stackLevel - right.stackLevel)
  }, [layers, layerStackLevels, stackColorsByLevel])
  const displayLayerColorsById = legendMode === 'stack' ? stackColorsByLayerId : layerColorsById
  const activeLayerColor = activeLayer
    ? displayLayerColorsById[activeLayer.id] ?? DEFAULT_FRONT_LAYER_COLOR
    : DEFAULT_FRONT_LAYER_COLOR
  const fallbackLayerStroke = themeMode === 'light' ? '#0f172a' : '#e2e8f0'
  const stitchStrokeColor = themeMode === 'light' ? STITCH_COLOR_LIGHT : STITCH_COLOR_DARK
  const foldStrokeColor = themeMode === 'light' ? FOLD_COLOR_LIGHT : FOLD_COLOR_DARK
  const activeLineTypeStrokeColor =
    activeLineType?.role === 'stitch'
      ? stitchStrokeColor
      : activeLineType?.role === 'fold'
        ? foldStrokeColor
        : activeLineType?.color ?? activeLayerColor
  const activeLineTypeDasharray = lineTypeStrokeDasharray(activeLineType?.style ?? 'solid')
  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      layers: deepClone(layers),
      activeLayerId,
      lineTypes: deepClone(lineTypes),
      activeLineTypeId,
      shapes: deepClone(shapes),
      foldLines: deepClone(foldLines),
      stitchHoles: deepClone(stitchHoles),
      tracingOverlays: deepClone(tracingOverlays),
      layerColorOverrides: deepClone(layerColorOverrides),
      frontLayerColor,
      backLayerColor,
    }),
    [
      layers,
      activeLayerId,
      lineTypes,
      activeLineTypeId,
      shapes,
      foldLines,
      stitchHoles,
      tracingOverlays,
      layerColorOverrides,
      frontLayerColor,
      backLayerColor,
    ],
  )
  const currentSnapshotSignature = useMemo(
    () => buildDocSnapshotSignature(currentSnapshot),
    [currentSnapshot],
  )

  const applyEditorSnapshot = (snapshot: EditorSnapshot) => {
    setLayers(snapshot.layers)
    setActiveLayerId(snapshot.activeLayerId)
    setLineTypes(snapshot.lineTypes)
    setActiveLineTypeId(snapshot.activeLineTypeId)
    setShapes(snapshot.shapes)
    setFoldLines(snapshot.foldLines)
    setStitchHoles(snapshot.stitchHoles)
    setTracingOverlays(snapshot.tracingOverlays)
    setLayerColorOverrides(snapshot.layerColorOverrides)
    setFrontLayerColor(snapshot.frontLayerColor)
    setBackLayerColor(snapshot.backLayerColor)
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
  }

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = []
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_STEP) {
      lines.push(
        <line key={`v-${i}`} x1={i} y1={-GRID_EXTENT} x2={i} y2={GRID_EXTENT} className="grid-line" />,
        <line key={`h-${i}`} x1={-GRID_EXTENT} y1={i} x2={GRID_EXTENT} y2={i} className="grid-line" />,
      )
    }
    lines.push(
      <line key="axis-y" x1={0} y1={-GRID_EXTENT} x2={0} y2={GRID_EXTENT} className="axis-line" />,
      <line key="axis-x" x1={-GRID_EXTENT} y1={0} x2={GRID_EXTENT} y2={0} className="axis-line" />,
    )
    return lines
  }, [])

  const previewElement = useMemo(() => {
    if (!cursorPoint || draftPoints.length === 0) {
      return null
    }

    if (tool === 'line' || tool === 'fold') {
      return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className={tool === 'fold' ? 'fold-preview' : 'shape-preview'}
            style={tool === 'fold' ? undefined : { stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
          />
        )
    }

    if (tool === 'arc') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
          />
        )
      }

      return (
        <path
          d={arcPath(draftPoints[0], draftPoints[1], cursorPoint)}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'bezier') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
          />
        )
      }

      return (
        <path
          d={`M ${round(draftPoints[0].x)} ${round(draftPoints[0].y)} Q ${round(draftPoints[1].x)} ${round(
            draftPoints[1].y,
          )} ${round(cursorPoint.x)} ${round(cursorPoint.y)}`}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    return null
  }, [cursorPoint, draftPoints, tool, activeLineTypeStrokeColor, activeLineTypeDasharray])

  const toWorldPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg) {
      return null
    }

    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    }
  }

  const zoomAtScreenPoint = (screenX: number, screenY: number, zoomFactor: number) => {
    setViewport((previous) => {
      const nextScale = clamp(previous.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM)
      const worldX = (screenX - previous.x) / previous.scale
      const worldY = (screenY - previous.y) / previous.scale
      return {
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
        scale: nextScale,
      }
    })
  }

  const handleZoomStep = (zoomFactor: number) => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    zoomAtScreenPoint(rect.width / 2, rect.height / 2, zoomFactor)
  }

  const handleResetView = () => {
    setViewport({ x: 560, y: 360, scale: 1 })
    setStatus('View reset')
  }

  const handleFitView = () => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    if (visibleShapes.length === 0) {
      handleResetView()
      return
    }

    const rect = svg.getBoundingClientRect()
    const bounds = getBounds(visibleShapes)
    const margin = 40
    const fitScale = clamp(
      Math.min((rect.width - margin * 2) / bounds.width, (rect.height - margin * 2) / bounds.height),
      MIN_ZOOM,
      MAX_ZOOM,
    )

    setViewport({
      scale: fitScale,
      x: rect.width / 2 - (bounds.minX + bounds.width / 2) * fitScale,
      y: rect.height / 2 - (bounds.minY + bounds.height / 2) * fitScale,
    })
    setStatus('View fit to visible shapes')
  }

  const beginPan = (clientX: number, clientY: number, pointerId: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
      pointerId,
    }
    setIsPanning(true)
  }

  const clearDraft = () => {
    setDraftPoints([])
    setCursorPoint(null)
  }

  const ensureActiveLayerWritable = () => {
    if (!activeLayer) {
      setStatus('No active layer available')
      return false
    }

    if (!activeLayer.visible) {
      setStatus('Active layer is hidden. Show it before drawing.')
      return false
    }

    if (activeLayer.locked) {
      setStatus('Active layer is locked. Unlock it before drawing.')
      return false
    }

    return true
  }

  const ensureActiveLineTypeWritable = () => {
    if (!activeLineType) {
      setStatus('No active line type available')
      return false
    }

    if (!activeLineType.visible) {
      setStatus('Active line type is hidden. Show it before drawing.')
      return false
    }

    return true
  }

  const resetDocument = (statusMessage = 'Document cleared and reset to Layer 1') => {
    const baseLayerId = uid()
    const defaultLineTypes = createDefaultLineTypes()
    setLayers([createDefaultLayer(baseLayerId)])
    setActiveLayerId(baseLayerId)
    setLineTypes(defaultLineTypes)
    setActiveLineTypeId(DEFAULT_ACTIVE_LINE_TYPE_ID)
    setShapes([])
    setFoldLines([])
    setStitchHoles([])
    setTracingOverlays([])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setLayerColorOverrides({})
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }

  const applyLoadedDocument = (doc: DocFile, statusMessage: string) => {
    const normalizedLayers = doc.layers.length > 0 ? doc.layers : [createDefaultLayer(uid())]
    const normalizedActiveLayerId = normalizedLayers.some((layer) => layer.id === doc.activeLayerId)
      ? doc.activeLayerId
      : normalizedLayers[0].id
    const nextLineTypes = normalizeLineTypes(doc.lineTypes ?? [])
    setLayers(normalizedLayers)
    setActiveLayerId(normalizedActiveLayerId)
    setLineTypes(nextLineTypes)
    setActiveLineTypeId(resolveActiveLineTypeId(nextLineTypes, doc.activeLineTypeId))
    setShapes(doc.objects)
    setFoldLines(doc.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(doc.stitchHoles ?? []))
    setTracingOverlays(doc.tracingOverlays ?? [])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setLayerColorOverrides({})
    setTool('pan')
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }

  const handleUndo = useCallback(() => {
    const result = applyUndo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to undo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Undo applied')
  }, [historyState, currentSnapshot])

  const handleRedo = useCallback(() => {
    const result = applyRedo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to redo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Redo applied')
  }, [historyState, currentSnapshot])

  const handleCopySelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to copy')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    setStatus(`Copied ${payload.shapes.length} shape${payload.shapes.length === 1 ? '' : 's'} to clipboard`)
  }, [selectedShapeIdSet, shapes, stitchHoles])

  const handleDeleteSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to delete')
      return
    }
    const deleteCount = selectedShapeIdSet.size
    setShapes((previous) => previous.filter((shape) => !selectedShapeIdSet.has(shape.id)))
    setStitchHoles((previous) => previous.filter((hole) => !selectedShapeIdSet.has(hole.shapeId)))
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setStatus(`Deleted ${deleteCount} selected shape${deleteCount === 1 ? '' : 's'}`)
  }, [selectedShapeIdSet])

  const handleCutSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to cut')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    const deleteCount = selectedShapeIdSet.size
    setShapes((previous) => previous.filter((shape) => !selectedShapeIdSet.has(shape.id)))
    setStitchHoles((previous) => previous.filter((hole) => !selectedShapeIdSet.has(hole.shapeId)))
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setStatus(`Cut ${deleteCount} selected shape${deleteCount === 1 ? '' : 's'}`)
  }, [selectedShapeIdSet, shapes, stitchHoles])

  const handlePasteClipboard = useCallback(() => {
    if (!clipboardPayload || clipboardPayload.shapes.length === 0) {
      setStatus('Clipboard is empty')
      return
    }

    pasteCountRef.current += 1
    const offset = {
      x: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
      y: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
    }
    const pasted = pasteClipboardPayload(clipboardPayload, offset, activeLayer?.id ?? null)
    setShapes((previous) => [...previous, ...pasted.shapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...pasted.stitchHoles]))
    setSelectedShapeIds(pasted.shapeIds)
    setSelectedStitchHoleId(null)
    setStatus(`Pasted ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'}`)
  }, [clipboardPayload, activeLayer])

  const handleDuplicateSelection = useCallback(() => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to duplicate')
      return
    }
    const payload = copySelectionToClipboard(shapes, stitchHoles, selectedShapeIdSet)
    setClipboardPayload(payload)
    pasteCountRef.current += 1
    const offset = {
      x: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
      y: CLIPBOARD_PASTE_OFFSET * pasteCountRef.current,
    }
    const pasted = pasteClipboardPayload(payload, offset, activeLayer?.id ?? null)
    setShapes((previous) => [...previous, ...pasted.shapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...pasted.stitchHoles]))
    setSelectedShapeIds(pasted.shapeIds)
    setSelectedStitchHoleId(null)
    setStatus(`Duplicated ${pasted.shapes.length} shape${pasted.shapes.length === 1 ? '' : 's'}`)
  }, [selectedShapeIdSet, shapes, stitchHoles, activeLayer])

  const handleMoveSelectionForward = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionByOneStep(previous, selectedShapeIdSet, 'forward'))
    setStatus('Moved selected shapes forward')
  }

  const handleMoveSelectionBackward = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionByOneStep(previous, selectedShapeIdSet, 'backward'))
    setStatus('Moved selected shapes backward')
  }

  const handleBringSelectionToFront = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionToEdge(previous, selectedShapeIdSet, 'front'))
    setStatus('Brought selected shapes to front')
  }

  const handleSendSelectionToBack = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to reorder')
      return
    }
    setShapes((previous) => moveSelectionToEdge(previous, selectedShapeIdSet, 'back'))
    setStatus('Sent selected shapes to back')
  }

  const buildCurrentDocFile = (): DocFile => ({
    version: 1,
    units: 'mm',
    layers,
    activeLayerId,
    lineTypes,
    activeLineTypeId,
    objects: shapes,
    foldLines,
    stitchHoles,
    tracingOverlays,
  })

  const handleSaveTemplateToRepository = () => {
    const defaultName = `Template ${templateRepository.length + 1}`
    const inputName = window.prompt('Template name', defaultName)?.trim()
    if (!inputName) {
      return
    }
    const entry = createTemplateFromDoc(inputName, buildCurrentDocFile())
    setTemplateRepository((previous) => [entry, ...previous])
    setSelectedTemplateEntryId(entry.id)
    setStatus(`Saved template "${entry.name}"`)
  }

  const handleDeleteTemplateFromRepository = (entryId: string) => {
    setTemplateRepository((previous) => previous.filter((entry) => entry.id !== entryId))
    if (selectedTemplateEntryId === entryId) {
      setSelectedTemplateEntryId(null)
    }
    setStatus('Template deleted')
  }

  const handleLoadTemplateAsDocument = () => {
    if (!selectedTemplateEntry) {
      setStatus('Select a template first')
      return
    }
    applyLoadedDocument(selectedTemplateEntry.doc, `Loaded template: ${selectedTemplateEntry.name}`)
  }

  const handleInsertTemplateIntoDocument = () => {
    if (!selectedTemplateEntry) {
      setStatus('Select a template first')
      return
    }
    const inserted = insertTemplateDocIntoCurrent(
      selectedTemplateEntry.doc,
      layers,
      lineTypes,
      shapes,
      foldLines,
      stitchHoles,
    )
    setLayers(inserted.layers)
    setLineTypes(inserted.lineTypes)
    setActiveLineTypeId(inserted.activeLineTypeId)
    setShapes(inserted.shapes)
    setFoldLines(inserted.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(inserted.stitchHoles))
    setSelectedShapeIds(inserted.insertedShapeIds)
    if (inserted.insertedLayerIds.length > 0) {
      setActiveLayerId(inserted.insertedLayerIds[0])
    }
    clearDraft()
    setStatus(`Inserted template: ${selectedTemplateEntry.name}`)
  }

  const handleExportTemplateRepository = () => {
    if (templateRepository.length === 0) {
      setStatus('Template repository is empty')
      return
    }
    const payload = serializeTemplateRepository(templateRepository)
    downloadFile('leathercraft-template-repository.json', payload, 'application/json;charset=utf-8')
    setStatus(`Exported ${templateRepository.length} template${templateRepository.length === 1 ? '' : 's'}`)
  }

  const handleImportTemplateRepositoryFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    try {
      const raw = await file.text()
      const importedEntries = parseTemplateRepositoryImport(raw)
      setTemplateRepository((previous) => {
        const existingById = new Map(previous.map((entry) => [entry.id, entry]))
        importedEntries.forEach((entry) => existingById.set(entry.id, entry))
        return Array.from(existingById.values()).sort((left, right) =>
          left.updatedAt > right.updatedAt ? -1 : 1,
        )
      })
      setStatus(`Imported ${importedEntries.length} template${importedEntries.length === 1 ? '' : 's'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Template import failed: ${message}`)
    }
  }

  const handleUpdateTracingOverlay = (overlayId: string, patch: Partial<TracingOverlay>) => {
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              ...patch,
            }
          : overlay,
      ),
    )
  }

  const handleDeleteTracingOverlay = (overlayId: string) => {
    setTracingOverlays((previous) => previous.filter((overlay) => overlay.id !== overlayId))
    setStatus('Tracing overlay removed')
  }

  const handleImportTracing = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      setStatus('Tracing import supports image files and PDFs only')
      return
    }

    const sourceUrl = URL.createObjectURL(file)
    const overlayId = uid()
    const nextOverlay: TracingOverlay = {
      id: overlayId,
      name: file.name,
      kind: isPdf ? 'pdf' : 'image',
      sourceUrl,
      visible: true,
      locked: true,
      opacity: isPdf ? 0.6 : 0.75,
      scale: 1,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      width: 800,
      height: 800,
      isObjectUrl: true,
    }

    if (isImage) {
      try {
        const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            resolve({
              width: image.naturalWidth || 800,
              height: image.naturalHeight || 800,
            })
          }
          image.onerror = () => reject(new Error('Could not read image'))
          image.src = sourceUrl
        })
        nextOverlay.width = size.width
        nextOverlay.height = size.height
      } catch {
        // Keep fallback dimensions for failed metadata reads.
      }
    }

    setTracingOverlays((previous) => [nextOverlay, ...previous])
    setActiveTracingOverlayId(overlayId)
    setShowTracingModal(true)
    setStatus(isPdf ? 'PDF tracing imported (vector preview box)' : 'Tracing image imported')
  }

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const sync = () => {
      if (media.matches) {
        setIsMobileLayout(true)
        setMobileViewMode('editor')
        setShowMobileMenu(false)
        setMobileOptionsTab('view')
        setTool('pan')
      } else {
        setIsMobileLayout(false)
        setMobileViewMode('split')
        setShowMobileMenu(true)
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (layers.length === 0) {
      return
    }
    if (!layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayerId(layers[0].id)
    }
  }, [layers, activeLayerId])

  useEffect(() => {
    if (lineTypes.length === 0) {
      setLineTypes(createDefaultLineTypes())
      return
    }
    if (!lineTypes.some((lineType) => lineType.id === activeLineTypeId)) {
      setActiveLineTypeId(lineTypes[0].id)
    }
  }, [lineTypes, activeLineTypeId])

  useEffect(() => {
    setSelectedShapeIds((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((shapeId) => shapeIdSet.has(shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes])

  useEffect(() => {
    setStitchHoles((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((stitchHole) => shapeIdSet.has(stitchHole.shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes])

  useEffect(() => {
    setSelectedStitchHoleId((previous) => {
      if (!previous) {
        return previous
      }
      return stitchHoles.some((stitchHole) => stitchHole.id === previous) ? previous : null
    })
  }, [stitchHoles])

  useEffect(() => {
    setLayerColorOverrides((previous) => {
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      let changed = false
      const next: Record<string, string> = {}

      for (const [layerId, color] of Object.entries(previous)) {
        if (layerIdSet.has(layerId)) {
          next[layerId] = color
        } else {
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [layers])

  useEffect(() => {
    setActiveTracingOverlayId((previous) => {
      if (!previous) {
        return tracingOverlays[0]?.id ?? null
      }
      return tracingOverlays.some((overlay) => overlay.id === previous) ? previous : tracingOverlays[0]?.id ?? null
    })
  }, [tracingOverlays])

  useEffect(() => {
    setSelectedTemplateEntryId((previous) => {
      if (!previous) {
        return templateRepository[0]?.id ?? null
      }
      return templateRepository.some((entry) => entry.id === previous) ? previous : templateRepository[0]?.id ?? null
    })
  }, [templateRepository])

  useEffect(() => {
    saveTemplateRepository(templateRepository)
  }, [templateRepository])

  useEffect(() => {
    const objectUrls = new Set(
      tracingOverlays
        .filter((overlay) => overlay.isObjectUrl)
        .map((overlay) => overlay.sourceUrl),
    )

    tracingObjectUrlsRef.current.forEach((url) => {
      if (!objectUrls.has(url)) {
        URL.revokeObjectURL(url)
      }
    })
    tracingObjectUrlsRef.current = objectUrls
  }, [tracingOverlays])

  useEffect(
    () => () => {
      tracingObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      tracingObjectUrlsRef.current.clear()
    },
    [],
  )

  useEffect(() => {
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false
      lastSnapshotRef.current = deepClone(currentSnapshot)
      lastSnapshotSignatureRef.current = currentSnapshotSignature
      return
    }

    if (!lastSnapshotSignatureRef.current || !lastSnapshotRef.current) {
      lastSnapshotRef.current = deepClone(currentSnapshot)
      lastSnapshotSignatureRef.current = currentSnapshotSignature
      return
    }

    if (lastSnapshotSignatureRef.current === currentSnapshotSignature) {
      return
    }

    setHistoryState((previousHistory) =>
      pushHistorySnapshot(previousHistory, lastSnapshotRef.current as EditorSnapshot, HISTORY_LIMIT),
    )
    lastSnapshotRef.current = deepClone(currentSnapshot)
    lastSnapshotSignatureRef.current = currentSnapshotSignature
  }, [currentSnapshot, currentSnapshotSignature])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearDraft()
        setStatus('Draft cancelled')
        return
      }

      const isMeta = event.ctrlKey || event.metaKey
      if (!isMeta) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const target = event.target as HTMLElement | null
          if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) {
            event.preventDefault()
            handleDeleteSelection()
          }
        }
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedo()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        handleRedo()
        return
      }
      if (key === 'c') {
        event.preventDefault()
        handleCopySelection()
        return
      }
      if (key === 'x') {
        event.preventDefault()
        handleCutSelection()
        return
      }
      if (key === 'v') {
        event.preventDefault()
        handlePasteClipboard()
        return
      }
      if (key === 'd') {
        event.preventDefault()
        handleDuplicateSelection()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleDeleteSelection,
  ])

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0 && !(event.button === 1 || event.button === 2)) {
      return
    }

    if (event.pointerType === 'touch' && panRef.current && panRef.current.pointerId !== event.pointerId) {
      return
    }

    if (tool === 'pan' || event.button === 1 || event.button === 2) {
      event.preventDefault()
      beginPan(event.clientX, event.clientY, event.pointerId)
      if (event.pointerType !== 'touch') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Touch browsers can throw here; pan still works without capture.
        }
      }
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    setCursorPoint(point)

    if (tool === 'line') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length === 0) {
        setDraftPoints([point])
        setStatus('Line: pick end point')
        return
      }

      const start = draftPoints[0]
      if (distance(start, point) < 0.001) {
        setStatus('Line ignored: start and end overlap')
        clearDraft()
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'line',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          start,
          end: point,
        },
      ])
      clearDraft()
      setStatus('Line created')
      return
    }

    if (tool === 'stitch-hole') {
      const nearestStitchAnchor = findNearestStitchAnchor(point, visibleShapes, lineTypesById, 16 / viewport.scale)
      if (!nearestStitchAnchor) {
        setStatus('No stitch path near pointer. Tap near a visible stitch line.')
        return
      }

      const targetShape = shapesById[nearestStitchAnchor.shapeId]
      if (!targetShape) {
        setStatus('Could not resolve stitch path')
        return
      }

      const targetLayer = layers.find((layer) => layer.id === targetShape.layerId)
      if (targetLayer?.locked) {
        setStatus('Target layer is locked. Unlock it before placing stitch holes.')
        return
      }

      let createdHoleId: string | null = null
      setStitchHoles((previous) => {
        const nextSequence =
          previous
            .filter((stitchHole) => stitchHole.shapeId === nearestStitchAnchor.shapeId)
            .reduce((maximum, stitchHole) => Math.max(maximum, stitchHole.sequence), -1) + 1
        const createdHole = {
          ...createStitchHole(nearestStitchAnchor, stitchHoleType),
          sequence: nextSequence,
        }
        createdHoleId = createdHole.id
        return [
          ...previous,
          createdHole,
        ]
      })
      setSelectedStitchHoleId(createdHoleId)
      setStatus(`Stitch hole placed (${stitchHoleType})`)
      return
    }

    if (tool === 'fold') {
      if (draftPoints.length === 0) {
        setDraftPoints([point])
        setStatus('Fold line: pick end point')
        return
      }

      const start = draftPoints[0]
      if (distance(start, point) < 0.001) {
        setStatus('Fold line ignored: start and end overlap')
        clearDraft()
        return
      }

      setFoldLines((previous) => [
        ...previous,
        {
          id: uid(),
          name: `Fold ${previous.length + 1}`,
          start,
          end: point,
          angleDeg: 0,
          maxAngleDeg: 180,
        },
      ])
      clearDraft()
      setStatus('Fold line assigned')
      return
    }

    if (tool === 'arc') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length < 2) {
        setDraftPoints((previous) => [...previous, point])
        setStatus(draftPoints.length === 0 ? 'Arc: pick midpoint' : 'Arc: pick end point')
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'arc',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          start: draftPoints[0],
          mid: draftPoints[1],
          end: point,
        },
      ])
      clearDraft()
      setStatus('Arc created')
      return
    }

    if (tool === 'bezier') {
      if (!ensureActiveLayerWritable() || !ensureActiveLineTypeWritable()) {
        return
      }

      if (draftPoints.length < 2) {
        setDraftPoints((previous) => [...previous, point])
        setStatus(draftPoints.length === 0 ? 'Bezier: pick control point' : 'Bezier: pick end point')
        return
      }

      setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'bezier',
          layerId: activeLayerId,
          lineTypeId: activeLineTypeId,
          start: draftPoints[0],
          control: draftPoints[1],
          end: point,
        },
      ])
      clearDraft()
      setStatus('Bezier created')
    }
  }

  const handleShapePointerDown = (event: ReactPointerEvent<SVGElement>, shapeId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    event.stopPropagation()

    setSelectedShapeIds((previous) => {
      const isAlreadySelected = previous.includes(shapeId)
      let next: string[]

      if (event.shiftKey) {
        next = isAlreadySelected ? previous.filter((entry) => entry !== shapeId) : [...previous, shapeId]
      } else {
        next = isAlreadySelected && previous.length === 1 ? [] : [shapeId]
      }

      setStatus(next.length === 0 ? 'Shape selection cleared' : `${next.length} shape${next.length === 1 ? '' : 's'} selected`)
      return next
    })
  }

  const handleStitchHolePointerDown = (event: ReactPointerEvent<SVGElement>, stitchHoleId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const stitchHole = stitchHoles.find((entry) => entry.id === stitchHoleId)
    if (!stitchHole) {
      return
    }

    event.stopPropagation()
    const nextId = selectedStitchHoleId === stitchHoleId ? null : stitchHoleId
    setSelectedStitchHoleId(nextId)
    setStatus(nextId ? `Stitch hole ${stitchHole.sequence + 1} selected` : 'Stitch-hole selection cleared')
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (isPanning && panState) {
      if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
        return
      }

      const deltaX = event.clientX - panState.startX
      const deltaY = event.clientY - panState.startY
      setViewport((previous) => ({
        ...previous,
        x: panState.originX + deltaX,
        y: panState.originY + deltaY,
      }))
      return
    }

    if (draftPoints.length === 0) {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      setCursorPoint(point)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (!isPanning || !panState) {
      return
    }

    if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
      return
    }

    setIsPanning(false)
    panRef.current = null
    if (event.pointerType !== 'touch') {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Safe no-op for browsers that fail pointer capture checks.
      }
    }
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    zoomAtScreenPoint(screenX, screenY, zoomFactor)
  }

  const getExportableShapes = () =>
    shapes.filter((shape) => {
      if (!visibleLayerIdSet.has(shape.layerId)) {
        return false
      }
      const lineType = lineTypesById[shape.lineTypeId]
      const role = lineType?.role ?? 'cut'
      const isVisible = lineType?.visible ?? true
      if (exportOnlyVisibleLineTypes && !isVisible) {
        return false
      }
      return exportRoleFilters[role]
    })

  const shapeToExportSvg = (shape: Shape) => {
    const lineType = lineTypesById[shape.lineTypeId]
    const stroke = lineType?.color ?? '#0f172a'
    const strokeDasharray = exportForceSolidStrokes ? undefined : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
    const dashAttribute = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : ''

    if (shape.type === 'line') {
      return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
    }

    if (shape.type === 'arc') {
      return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
    }

    return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
  }

  const handleExportSvg = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const bounds = getBounds(exportShapes)
    const objectMarkup = exportShapes.map(shapeToExportSvg).join('\n  ')
    const includeFoldLines = exportRoleFilters.fold
    const foldMarkup = includeFoldLines
      ? foldLines
          .map(
            (foldLine) =>
              `<line x1="${round(foldLine.start.x)}" y1="${round(foldLine.start.y)}" x2="${round(foldLine.end.x)}" y2="${round(foldLine.end.y)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4" fill="none" data-type="fold-line"/>`,
          )
          .join('\n  ')
      : ''

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}">\n  <rect x="${round(bounds.minX)}" y="${round(bounds.minY)}" width="${round(bounds.width)}" height="${round(bounds.height)}" fill="white"/>\n  ${objectMarkup}\n  ${foldMarkup}\n</svg>`

    downloadFile('leathercraft-export.svg', svg, 'image/svg+xml;charset=utf-8')
    setStatus(`Exported SVG (${exportShapes.length} shapes, ${includeFoldLines ? foldLines.length : 0} folds)`)
  }

  const handleExportDxf = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const { content, segmentCount } = buildDxfFromShapes(exportShapes, {
      flipY: dxfFlipY,
      version: dxfVersion,
      forceSolidLineStyle: exportForceSolidStrokes,
      lineTypeStyles: lineTypeStylesById,
    })
    downloadFile('leathercraft-export.dxf', content, 'application/dxf')
    setStatus(
      `Exported DXF ${dxfVersion.toUpperCase()} (${segmentCount} segments, flipY ${dxfFlipY ? 'on' : 'off'})`,
    )
  }

  const handleSaveJson = () => {
    const doc = buildCurrentDocFile()
    downloadFile('leathercraft-doc.json', JSON.stringify(doc, null, 2), 'application/json;charset=utf-8')
    setStatus('Document JSON saved')
  }

  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as {
        objects?: unknown[]
        foldLines?: unknown[]
        stitchHoles?: unknown[]
        tracingOverlays?: unknown[]
        layers?: unknown[]
        activeLayerId?: unknown
        lineTypes?: unknown[]
        activeLineTypeId?: unknown
      }

      if (!Array.isArray(parsed.objects)) {
        throw new Error('Missing objects array')
      }

      const parsedLayers =
        Array.isArray(parsed.layers)
          ? parsed.layers.map(parseLayer).filter((layer): layer is Layer => layer !== null)
          : []

      const nextLayers =
        parsedLayers.length > 0
          ? parsedLayers
          : [
              {
                id: uid(),
                name: 'Layer 1',
                visible: true,
                locked: false,
                stackLevel: 0,
              },
            ]

      const nextActiveLayerId =
        typeof parsed.activeLayerId === 'string' && nextLayers.some((layer) => layer.id === parsed.activeLayerId)
          ? parsed.activeLayerId
          : nextLayers[0].id

      const parsedLineTypes = Array.isArray(parsed.lineTypes)
        ? parsed.lineTypes.map((candidate, index) => parseLineType(candidate, index)).filter((lineType): lineType is LineType => lineType !== null)
        : []
      const nextLineTypes = normalizeLineTypes(parsedLineTypes)
      const nextActiveLineTypeId = resolveActiveLineTypeId(nextLineTypes, parsed.activeLineTypeId)

      const nextShapes: Shape[] = []
      const shapeIdMap = new Map<string, string>()
      for (const candidate of parsed.objects) {
        if (!isShapeLike(candidate)) {
          throw new Error('Invalid shape in objects array')
        }

        const rawLayerId =
          typeof (candidate as { layerId?: unknown }).layerId === 'string'
            ? (candidate as { layerId: string }).layerId
            : nextActiveLayerId
        const layerId = nextLayers.some((layer) => layer.id === rawLayerId) ? rawLayerId : nextActiveLayerId
        const lineTypeId = resolveShapeLineTypeId(
          nextLineTypes,
          (candidate as { lineTypeId?: unknown }).lineTypeId,
          nextActiveLineTypeId,
        )

        const sourceShapeId =
          typeof (candidate as { id?: unknown }).id === 'string' && (candidate as { id: string }).id.length > 0
            ? (candidate as { id: string }).id
            : uid()
        const nextShapeId = uid()
        shapeIdMap.set(sourceShapeId, nextShapeId)

        if (candidate.type === 'line') {
          nextShapes.push({
            id: nextShapeId,
            type: 'line',
            layerId,
            lineTypeId,
            start: candidate.start,
            end: candidate.end,
          })
        } else if (candidate.type === 'arc') {
          nextShapes.push({
            id: nextShapeId,
            type: 'arc',
            layerId,
            lineTypeId,
            start: candidate.start,
            mid: candidate.mid,
            end: candidate.end,
          })
        } else {
          nextShapes.push({
            id: nextShapeId,
            type: 'bezier',
            layerId,
            lineTypeId,
            start: candidate.start,
            control: candidate.control,
            end: candidate.end,
          })
        }
      }

      const nextFoldLines: FoldLine[] = []
      if (Array.isArray(parsed.foldLines)) {
        for (const foldCandidate of parsed.foldLines) {
          const foldLine = parseFoldLine(foldCandidate)
          if (foldLine) {
            nextFoldLines.push(foldLine)
          }
        }
      }

      const nextStitchHoles: StitchHole[] = []
      if (Array.isArray(parsed.stitchHoles)) {
        for (const stitchHoleCandidate of parsed.stitchHoles) {
          const stitchHole = parseStitchHole(stitchHoleCandidate)
          const mappedShapeId = stitchHole ? shapeIdMap.get(stitchHole.shapeId) : null
          if (stitchHole && mappedShapeId) {
            nextStitchHoles.push({
              ...stitchHole,
              shapeId: mappedShapeId,
            })
          }
        }
      }
      const normalizedStitchHoles = normalizeStitchHoleSequences(nextStitchHoles)
      const nextTracingOverlays = Array.isArray(parsed.tracingOverlays)
        ? parsed.tracingOverlays
            .map(parseTracingOverlay)
            .filter((overlay): overlay is TracingOverlay => overlay !== null)
        : []

      applyLoadedDocument(
        {
          version: 1,
          units: 'mm',
          layers: nextLayers,
          activeLayerId: nextActiveLayerId,
          lineTypes: nextLineTypes,
          activeLineTypeId: nextActiveLineTypeId,
          objects: nextShapes,
          foldLines: nextFoldLines,
          stitchHoles: normalizedStitchHoles,
          tracingOverlays: nextTracingOverlays,
        },
        `Loaded JSON (${nextShapes.length} shapes, ${nextFoldLines.length} folds, ${normalizedStitchHoles.length} holes, ${nextLayers.length} layers)`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Load failed: ${message}`)
    }
  }

  const handleImportSvg = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    if (!activeLayer) {
      setStatus('No active layer to import into')
      return
    }

    try {
      const rawSvg = await file.text()
      const imported = importSvgAsShapes(rawSvg, {
        layerId: activeLayer.id,
        lineTypeId: activeLineTypeId,
      })
      if (imported.shapes.length === 0) {
        setStatus('SVG import produced no drawable shapes')
        return
      }
      setShapes((previous) => [...previous, ...imported.shapes])
      setSelectedShapeIds(imported.shapes.map((shape) => shape.id))
      if (imported.warnings.length > 0) {
        setStatus(`Imported SVG (${imported.shapes.length} shapes) with ${imported.warnings.length} warning(s)`)
      } else {
        setStatus(`Imported SVG (${imported.shapes.length} shapes)`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`SVG import failed: ${message}`)
    }
  }

  const handleLoadPreset = (presetId = selectedPresetId) => {
    const preset = PRESET_DOCS.find((entry) => entry.id === presetId)
    if (!preset) {
      setStatus('Preset not found')
      return
    }

    const sample =
      typeof structuredClone === 'function'
        ? structuredClone(preset.doc)
        : (JSON.parse(JSON.stringify(preset.doc)) as DocFile)

    applyLoadedDocument(sample, `Loaded preset: ${preset.label} (${sample.objects.length} shapes, ${sample.foldLines.length} folds)`)
    setShowThreePreview(true)
    if (isMobileLayout) {
      setMobileViewMode('editor')
      setShowMobileMenu(false)
    }
  }

  const handleAddLayer = () => {
    const nextLayerId = uid()
    setLayers((previous) => [
      ...previous,
      {
        id: nextLayerId,
        name: newLayerName(previous.length),
        visible: true,
        locked: false,
        stackLevel:
          previous.reduce(
            (maximum, layer, index) =>
              Math.max(
                maximum,
                typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel) ? layer.stackLevel : index,
              ),
            -1,
          ) + 1,
      },
    ])
    setActiveLayerId(nextLayerId)
    setStatus('Layer added')
  }

  const handleRenameActiveLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to rename')
      return
    }

    const nextName = window.prompt('Layer name', activeLayer.name)?.trim()
    if (!nextName) {
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              name: nextName,
            }
          : layer,
      ),
    )
    setStatus(`Renamed layer to "${nextName}"`)
  }

  const handleToggleLayerVisibility = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              visible: !layer.visible,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.visible ? 'Active layer hidden' : 'Active layer shown')
  }

  const handleToggleLayerLock = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              locked: !layer.locked,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.locked ? 'Active layer unlocked' : 'Active layer locked')
  }

  const handleMoveLayer = (direction: -1 | 1) => {
    if (!activeLayer) {
      return
    }

    setLayers((previous) => {
      const index = previous.findIndex((layer) => layer.id === activeLayer.id)
      if (index < 0) {
        return previous
      }

      const target = index + direction
      if (target < 0 || target >= previous.length) {
        return previous
      }

      const next = [...previous]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setStatus(direction < 0 ? 'Moved layer up' : 'Moved layer down')
  }

  const handleDeleteLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to delete')
      return
    }

    if (layers.length === 1) {
      setStatus('Cannot delete the last remaining layer')
      return
    }

    const activeIndex = layers.findIndex((layer) => layer.id === activeLayer.id)
    if (activeIndex < 0) {
      return
    }

    const fallbackLayer = layers[activeIndex > 0 ? activeIndex - 1 : 1]
    const deleteLayerId = activeLayer.id

    setLayers((previous) => previous.filter((layer) => layer.id !== deleteLayerId))
    setActiveLayerId(fallbackLayer.id)
    setShapes((previous) =>
      previous.map((shape) =>
        shape.layerId === deleteLayerId
          ? {
              ...shape,
              layerId: fallbackLayer.id,
            }
          : shape,
      ),
    )
    setStatus(`Deleted layer and moved its shapes to "${fallbackLayer.name}"`)
  }

  const handleToggleActiveLineTypeVisibility = () => {
    if (!activeLineType) {
      setStatus('No active line type to update')
      return
    }

    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              visible: !lineType.visible,
            }
          : lineType,
      ),
    )

    setStatus(activeLineType.visible ? `Line type hidden: ${activeLineType.name}` : `Line type shown: ${activeLineType.name}`)
  }

  const handleShowAllLineTypes = () => {
    setLineTypes((previous) => previous.map((lineType) => ({ ...lineType, visible: true })))
    setStatus('All line types shown')
  }

  const handleIsolateActiveLineType = () => {
    if (!activeLineType) {
      setStatus('No active line type to isolate')
      return
    }

    setLineTypes((previous) =>
      previous.map((lineType) => ({
        ...lineType,
        visible: lineType.id === activeLineType.id,
      })),
    )
    setStatus(`Isolated line type: ${activeLineType.name}`)
  }

  const handleUpdateActiveLineTypeRole = (role: LineType['role']) => {
    if (!activeLineType) {
      return
    }
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              role,
            }
          : lineType,
      ),
    )
    setStatus(`Line type role set to ${role}`)
  }

  const handleUpdateActiveLineTypeStyle = (style: LineType['style']) => {
    if (!activeLineType) {
      return
    }
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              style,
            }
          : lineType,
      ),
    )
    setStatus(`Line type style set to ${style}`)
  }

  const handleUpdateActiveLineTypeColor = (color: string) => {
    if (!activeLineType) {
      return
    }
    const normalized = normalizeHexColor(color, activeLineType.color)
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              color: normalized,
            }
          : lineType,
      ),
    )
  }

  const handleSelectShapesByActiveLineType = () => {
    if (!activeLineType) {
      return
    }

    const nextSelected = shapes.filter((shape) => shape.lineTypeId === activeLineType.id).map((shape) => shape.id)
    setSelectedShapeIds(nextSelected)
    setStatus(`Selected ${nextSelected.length} shapes on ${activeLineType.name}`)
  }

  const handleAssignSelectedToActiveLineType = () => {
    if (!activeLineType) {
      return
    }

    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to assign')
      return
    }

    setShapes((previous) => applyLineTypeToShapeIds(previous, selectedShapeIdSet, activeLineType.id))
    setStatus(`Assigned ${selectedShapeIdSet.size} selected shapes to ${activeLineType.name}`)
  }

  const handleClearShapeSelection = () => {
    setSelectedShapeIds([])
    setStatus('Shape selection cleared')
  }

  const handleSetLayerColorOverride = (layerId: string, nextColor: string) => {
    const normalizedColor = normalizeHexColor(nextColor, layerColorsById[layerId] ?? DEFAULT_FRONT_LAYER_COLOR)
    setLayerColorOverrides((previous) => ({
      ...previous,
      [layerId]: normalizedColor,
    }))
  }

  const handleClearLayerColorOverride = (layerId: string) => {
    setLayerColorOverrides((previous) => {
      if (!(layerId in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[layerId]
      return next
    })
  }

  const handleResetLayerColors = () => {
    setFrontLayerColor(DEFAULT_FRONT_LAYER_COLOR)
    setBackLayerColor(DEFAULT_BACK_LAYER_COLOR)
    setLayerColorOverrides({})
    setStatus('Layer color continuum reset')
  }

  const handleCountStitchHolesOnSelectedShapes = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first to count stitch holes')
      return
    }
    setStatus(`Selected shapes contain ${selectedStitchHoleCount} stitch hole${selectedStitchHoleCount === 1 ? '' : 's'}`)
  }

  const handleDeleteStitchHolesOnSelectedShapes = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first to delete stitch holes')
      return
    }

    if (selectedStitchHoleCount === 0) {
      setStatus('Selected shapes do not contain stitch holes')
      return
    }

    setStitchHoles((previous) => normalizeStitchHoleSequences(deleteStitchHolesForShapes(previous, selectedShapeIdSet)))
    setStatus(`Deleted ${selectedStitchHoleCount} stitch hole${selectedStitchHoleCount === 1 ? '' : 's'} on selected shapes`)
  }

  const handleClearAllStitchHoles = () => {
    if (stitchHoles.length === 0) {
      setStatus('No stitch holes to clear')
      return
    }
    setStitchHoles([])
    setSelectedStitchHoleId(null)
    setStatus('Cleared all stitch holes')
  }

  const getSelectedStitchShapes = () =>
    shapes.filter((shape) => {
      if (!selectedShapeIdSet.has(shape.id)) {
        return false
      }
      const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
      return lineTypeRole === 'stitch'
    })

  const handleAutoPlaceFixedPitchStitchHoles = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedStitchShapes = getSelectedStitchShapes()

    if (selectedStitchShapes.length === 0) {
      setStatus('Selected shapes are not stitch-role paths')
      return
    }

    const safePitch = clamp(stitchPitchMm, 0.2, 100)
    const selectedShapeIds = new Set(selectedStitchShapes.map((shape) => shape.id))
    const generatedHoles = selectedStitchShapes.flatMap((shape) =>
      generateFixedPitchStitchHoles(shape, safePitch, stitchHoleType, 0),
    )

    setStitchHoles((previous) => {
      const retained = previous.filter((stitchHole) => !selectedShapeIds.has(stitchHole.shapeId))
      return normalizeStitchHoleSequences([...retained, ...generatedHoles])
    })
    setSelectedStitchHoleId(generatedHoles[0]?.id ?? null)

    setStatus(
      `Auto placed ${generatedHoles.length} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} at ${safePitch.toFixed(1)}mm pitch`,
    )
  }

  const handleAutoPlaceVariablePitchStitchHoles = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedStitchShapes = getSelectedStitchShapes()
    if (selectedStitchShapes.length === 0) {
      setStatus('Selected shapes are not stitch-role paths')
      return
    }

    const safeStartPitch = clamp(stitchVariablePitchStartMm, 0.2, 100)
    const safeEndPitch = clamp(stitchVariablePitchEndMm, 0.2, 100)
    const selectedShapeIds = new Set(selectedStitchShapes.map((shape) => shape.id))
    const generatedHoles = selectedStitchShapes.flatMap((shape) =>
      generateVariablePitchStitchHoles(shape, safeStartPitch, safeEndPitch, stitchHoleType, 0),
    )

    setStitchHoles((previous) => {
      const retained = previous.filter((stitchHole) => !selectedShapeIds.has(stitchHole.shapeId))
      return normalizeStitchHoleSequences([...retained, ...generatedHoles])
    })
    setSelectedStitchHoleId(generatedHoles[0]?.id ?? null)

    setStatus(
      `Auto placed ${generatedHoles.length} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} using ${safeStartPitch.toFixed(1)} to ${safeEndPitch.toFixed(1)}mm pitch`,
    )
  }

  const handleResequenceSelectedStitchHoles = (reverse = false) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedShapes = shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
    if (selectedShapes.length === 0) {
      setStatus('No selected shapes to re-sequence')
      return
    }

    setStitchHoles((previous) => {
      const byShape = new Map<string, StitchHole[]>()
      for (const hole of previous) {
        const entries = byShape.get(hole.shapeId) ?? []
        entries.push(hole)
        byShape.set(hole.shapeId, entries)
      }

      const preserved: StitchHole[] = []
      for (const hole of previous) {
        if (!selectedShapeIdSet.has(hole.shapeId)) {
          preserved.push(hole)
        }
      }

      const resequenced: StitchHole[] = []
      for (const shape of selectedShapes) {
        const holes = byShape.get(shape.id) ?? []
        if (holes.length === 0) {
          continue
        }
        resequenced.push(...resequenceStitchHolesOnShape(holes, shape, reverse))
      }
      return normalizeStitchHoleSequences([...preserved, ...resequenced])
    })

    setStatus(reverse ? 'Reversed stitch-hole order on selected paths' : 'Re-sequenced stitch holes on selected paths')
  }

  const handleSelectNextStitchHole = () => {
    const preferredShapeId =
      selectedStitchHole?.shapeId ??
      shapes.find((shape) => selectedShapeIdSet.has(shape.id) && (stitchHoleCountsByShape[shape.id] ?? 0) > 0)?.id ??
      stitchHoles[0]?.shapeId ??
      null

    if (!preferredShapeId) {
      setStatus('No stitch holes available to select')
      return
    }

    const holesOnShape = stitchHoles.filter((stitchHole) => stitchHole.shapeId === preferredShapeId)
    const currentHoleId = selectedStitchHole?.shapeId === preferredShapeId ? selectedStitchHole.id : null
    const nextHole = selectNextStitchHole(holesOnShape, currentHoleId)
    if (!nextHole) {
      setStatus('No stitch holes available to select')
      return
    }

    setSelectedStitchHoleId(nextHole.id)
    setStatus(`Selected stitch hole ${nextHole.sequence + 1} of ${holesOnShape.length}`)
  }

  const handleFixStitchHoleOrderFromSelected = (reverse = false) => {
    if (!selectedStitchHole) {
      setStatus('Select a stitch hole first (Move tool)')
      return
    }

    const targetShape = shapesById[selectedStitchHole.shapeId]
    if (!targetShape) {
      setStatus('Selected stitch hole has no valid path')
      return
    }

    const targetLayer = layers.find((layer) => layer.id === targetShape.layerId)
    if (targetLayer?.locked) {
      setStatus('Target layer is locked. Unlock it before editing stitch order.')
      return
    }

    const lineTypeRole = lineTypesById[targetShape.lineTypeId]?.role ?? 'cut'
    if (lineTypeRole !== 'stitch') {
      setStatus('Selected stitch hole is not on a stitch-role path')
      return
    }

    setStitchHoles((previous) => {
      const onShape = previous.filter((stitchHole) => stitchHole.shapeId === targetShape.id)
      const retained = previous.filter((stitchHole) => stitchHole.shapeId !== targetShape.id)
      const fixedOrder = fixStitchHoleOrderFromHole(onShape, targetShape, selectedStitchHole.id, reverse)
      return normalizeStitchHoleSequences([...retained, ...fixedOrder])
    })

    setStatus(reverse ? 'Fixed stitch order in reverse from selected hole' : 'Fixed stitch order from selected hole')
  }

  const handleRunMobileLayerAction = () => {
    if (mobileLayerAction === 'add') {
      handleAddLayer()
      return
    }

    if (mobileLayerAction === 'rename') {
      handleRenameActiveLayer()
      return
    }

    if (mobileLayerAction === 'toggle-visibility') {
      handleToggleLayerVisibility()
      return
    }

    if (mobileLayerAction === 'toggle-lock') {
      handleToggleLayerLock()
      return
    }

    if (mobileLayerAction === 'move-up') {
      handleMoveLayer(-1)
      return
    }

    if (mobileLayerAction === 'move-down') {
      handleMoveLayer(1)
      return
    }

    if (mobileLayerAction === 'delete') {
      handleDeleteLayer()
      return
    }

    setShowLayerColorModal(true)
  }

  const handleRunMobileFileAction = () => {
    if (mobileFileAction === 'save-json') {
      handleSaveJson()
      return
    }

    if (mobileFileAction === 'load-json') {
      fileInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'import-svg') {
      svgInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'load-preset') {
      handleLoadPreset()
      return
    }

    if (mobileFileAction === 'export-svg') {
      handleExportSvg()
      return
    }

    if (mobileFileAction === 'export-dxf') {
      handleExportDxf()
      return
    }

    if (mobileFileAction === 'export-options') {
      setShowExportOptionsModal(true)
      return
    }

    if (mobileFileAction === 'template-repository') {
      setShowTemplateRepositoryModal(true)
      return
    }

    if (mobileFileAction === 'import-tracing') {
      tracingInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'print-preview') {
      setShowPrintPreviewModal(true)
      return
    }

    if (mobileFileAction === 'undo') {
      handleUndo()
      return
    }

    if (mobileFileAction === 'redo') {
      handleRedo()
      return
    }

    if (mobileFileAction === 'copy') {
      handleCopySelection()
      return
    }

    if (mobileFileAction === 'paste') {
      handlePasteClipboard()
      return
    }

    if (mobileFileAction === 'delete') {
      handleDeleteSelection()
      return
    }

    if (mobileFileAction === 'toggle-3d') {
      setShowThreePreview((previous) => !previous)
      return
    }

    resetDocument()
  }

  const handleToggleTheme = () => {
    setThemeMode((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark'
      setStatus(next === 'light' ? 'White mode enabled' : 'Dark mode enabled')
      return next
    })
  }

  const setActiveTool = (nextTool: Tool) => {
    setTool(nextTool)
    clearDraft()
    setStatus(`Tool selected: ${toolLabel(nextTool)}`)
  }

  const workspaceClassName = `workspace ${isMobileLayout ? `mobile-${mobileViewMode}` : 'desktop'}`
  const topbarClassName = `topbar ${isMobileLayout ? 'topbar-mobile' : ''} ${
    isMobileLayout && !showMobileMenu ? 'topbar-compact' : ''
  }`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)
  const showViewOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'view')
  const showLayerOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'layers')
  const showFileOptions = !isMobileLayout || (showMobileMenu && mobileOptionsTab === 'file')
  const showMeta = !isMobileLayout || showMobileMenu
  const showLayerLegend = !(isMobileLayout && mobileViewMode === 'split')

  return (
    <div className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <header className={topbarClassName}>
        <div className="group tool-group">
          {isMobileLayout ? (
            <>
              <select
                className="tool-select-mobile"
                value={tool}
                onChange={(event) => setActiveTool(event.target.value as Tool)}
              >
                {TOOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Tool: {option.label}
                  </option>
                ))}
              </select>
              <div className="mobile-view-inline-tabs" role="tablist" aria-label="Mobile view mode">
                <button
                  className={mobileViewMode === 'editor' ? 'active' : ''}
                  onClick={() => setMobileViewMode('editor')}
                  disabled={!isMobileLayout}
                >
                  2D
                </button>
                <button
                  className={mobileViewMode === 'preview' ? 'active' : ''}
                  onClick={() => setMobileViewMode('preview')}
                  disabled={!isMobileLayout || !showThreePreview}
                >
                  3D
                </button>
                <button
                  className={mobileViewMode === 'split' ? 'active' : ''}
                  onClick={() => setMobileViewMode('split')}
                  disabled={!isMobileLayout || !showThreePreview}
                >
                  Split
                </button>
              </div>
            </>
          ) : (
            <>
              <button className={tool === 'pan' ? 'active' : ''} onClick={() => setActiveTool('pan')}>
                Move
              </button>
              <button className={tool === 'line' ? 'active' : ''} onClick={() => setActiveTool('line')}>
                Line
              </button>
              <button className={tool === 'arc' ? 'active' : ''} onClick={() => setActiveTool('arc')}>
                Arc
              </button>
              <button className={tool === 'bezier' ? 'active' : ''} onClick={() => setActiveTool('bezier')}>
                Bezier
              </button>
              <button className={tool === 'fold' ? 'active' : ''} onClick={() => setActiveTool('fold')}>
                Fold
              </button>
              <button className={tool === 'stitch-hole' ? 'active' : ''} onClick={() => setActiveTool('stitch-hole')}>
                Stitch Hole
              </button>
            </>
          )}
          {isMobileLayout && (
            <button
              className="mobile-menu-toggle"
              onClick={() =>
                setShowMobileMenu((previous) => {
                  const next = !previous
                  if (next) {
                    setMobileOptionsTab('view')
                  }
                  return next
                })
              }
            >
              {showMobileMenu ? 'Close' : 'Options'}
            </button>
          )}
        </div>

        {isMobileLayout && showMobileMenu && (
          <div className="group mobile-options-tabs">
            {MOBILE_OPTIONS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={mobileOptionsTab === tab.value ? 'active' : ''}
                onClick={() => setMobileOptionsTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className={`group preset-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <select
            className="preset-select"
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            {PRESET_DOCS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <button onClick={() => handleLoadPreset()}>Load Preset</button>
          <button onClick={handleToggleTheme}>{themeMode === 'dark' ? 'White Mode' : 'Dark Mode'}</button>
        </div>

        <div className={`group zoom-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <button onClick={() => handleZoomStep(0.85)}>-</button>
          <button onClick={() => handleZoomStep(1.15)}>+</button>
          <button onClick={handleFitView}>Fit</button>
          <button onClick={handleResetView}>Reset</button>
        </div>

        <div className={`group edit-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <button onClick={handleUndo} disabled={!canUndo}>
            Undo
          </button>
          <button onClick={handleRedo} disabled={!canRedo}>
            Redo
          </button>
          <button onClick={handleCopySelection} disabled={selectedShapeCount === 0}>
            Copy
          </button>
          <button onClick={handleCutSelection} disabled={selectedShapeCount === 0}>
            Cut
          </button>
          <button onClick={handlePasteClipboard} disabled={!clipboardPayload || clipboardPayload.shapes.length === 0}>
            Paste
          </button>
          <button onClick={handleDuplicateSelection} disabled={selectedShapeCount === 0}>
            Duplicate
          </button>
          <button onClick={handleDeleteSelection} disabled={selectedShapeCount === 0}>
            Delete
          </button>
          <button onClick={handleMoveSelectionBackward} disabled={selectedShapeCount === 0}>
            Send Back
          </button>
          <button onClick={handleMoveSelectionForward} disabled={selectedShapeCount === 0}>
            Bring Forward
          </button>
          <button onClick={handleSendSelectionToBack} disabled={selectedShapeCount === 0}>
            To Back
          </button>
          <button onClick={handleBringSelectionToFront} disabled={selectedShapeCount === 0}>
            To Front
          </button>
        </div>

        <div className={`group line-type-controls ${showViewOptions ? '' : 'mobile-hidden'}`}>
          <span className="line-type-label">Line Type</span>
          <select
            className="line-type-select"
            value={activeLineType?.id ?? ''}
            onChange={(event) => setActiveLineTypeId(event.target.value)}
          >
            {lineTypes.map((lineType) => (
              <option key={lineType.id} value={lineType.id}>
                {lineType.name}
                {` [${lineType.role}]`}
                {lineType.visible ? '' : ' (hidden)'}
              </option>
            ))}
          </select>
          <button onClick={handleToggleActiveLineTypeVisibility} disabled={!activeLineType}>
            {activeLineType?.visible ? 'Hide Type' : 'Show Type'}
          </button>
          <button onClick={() => setShowLineTypePalette(true)}>Palette</button>
        </div>

        {showViewOptions && (
          <StitchHolePanel
            holeType={stitchHoleType}
            onChangeHoleType={setStitchHoleType}
            pitchMm={stitchPitchMm}
            onChangePitchMm={(nextPitch) => setStitchPitchMm(clamp(nextPitch || 0, 0.2, 100))}
            variablePitchStartMm={stitchVariablePitchStartMm}
            variablePitchEndMm={stitchVariablePitchEndMm}
            onChangeVariablePitchStartMm={(nextPitch) => setStitchVariablePitchStartMm(clamp(nextPitch || 0, 0.2, 100))}
            onChangeVariablePitchEndMm={(nextPitch) => setStitchVariablePitchEndMm(clamp(nextPitch || 0, 0.2, 100))}
            onAutoPlaceFixedPitch={handleAutoPlaceFixedPitchStitchHoles}
            onAutoPlaceVariablePitch={handleAutoPlaceVariablePitchStitchHoles}
            onResequenceSelected={() => handleResequenceSelectedStitchHoles(false)}
            onReverseSelected={() => handleResequenceSelectedStitchHoles(true)}
            onSelectNextHole={handleSelectNextStitchHole}
            onFixOrderFromSelected={() => handleFixStitchHoleOrderFromSelected(false)}
            onFixReverseOrderFromSelected={() => handleFixStitchHoleOrderFromSelected(true)}
            showSequenceLabels={showStitchSequenceLabels}
            onToggleSequenceLabels={() => setShowStitchSequenceLabels((previous) => !previous)}
            onCountSelected={handleCountStitchHolesOnSelectedShapes}
            onDeleteOnSelected={handleDeleteStitchHolesOnSelectedShapes}
            onClearAll={handleClearAllStitchHoles}
            selectedShapeCount={selectedShapeCount}
            selectedHoleCount={selectedStitchHoleCount}
            totalHoleCount={stitchHoles.length}
            hasSelectedHole={selectedStitchHole !== null}
          />
        )}

        <div className={`group layer-controls ${showLayerOptions ? '' : 'mobile-hidden'}`}>
          <span className="layer-label">Layer</span>
          <select
            className="layer-select"
            value={activeLayer?.id ?? ''}
            onChange={(event) => {
              setActiveLayerId(event.target.value)
              clearDraft()
            }}
          >
            {layers.map((layer, index) => (
              <option key={layer.id} value={layer.id}>
                {index + 1}. {layer.name}
                {` [z${layerStackLevels[layer.id] ?? index}]`}
                {layer.visible ? '' : ' (hidden)'}
                {layer.locked ? ' (locked)' : ''}
              </option>
            ))}
          </select>
          {isMobileLayout ? (
            <div className="group mobile-action-row">
              <select
                className="action-select"
                value={mobileLayerAction}
                onChange={(event) => setMobileLayerAction(event.target.value as MobileLayerAction)}
              >
                <option value="add">Add Layer</option>
                <option value="rename">Rename Layer</option>
                <option value="toggle-visibility">{activeLayer?.visible ? 'Hide Layer' : 'Show Layer'}</option>
                <option value="toggle-lock">{activeLayer?.locked ? 'Unlock Layer' : 'Lock Layer'}</option>
                <option value="move-up">Move Layer Up</option>
                <option value="move-down">Move Layer Down</option>
                <option value="delete">Delete Layer</option>
                <option value="colors">Layer Colors</option>
              </select>
              <button onClick={handleRunMobileLayerAction} disabled={layers.length === 0}>
                Apply
              </button>
            </div>
          ) : (
            <>
              <button onClick={handleAddLayer}>+ Layer</button>
              <button onClick={handleRenameActiveLayer} disabled={!activeLayer}>
                Rename
              </button>
              <button onClick={handleToggleLayerVisibility} disabled={!activeLayer}>
                {activeLayer?.visible ? 'Hide' : 'Show'}
              </button>
              <button onClick={handleToggleLayerLock} disabled={!activeLayer}>
                {activeLayer?.locked ? 'Unlock' : 'Lock'}
              </button>
              <button onClick={() => handleMoveLayer(-1)} disabled={!activeLayer || layers.length < 2}>
                Up
              </button>
              <button onClick={() => handleMoveLayer(1)} disabled={!activeLayer || layers.length < 2}>
                Down
              </button>
              <button onClick={handleDeleteLayer} disabled={!activeLayer || layers.length < 2}>
                Delete
              </button>
              <button onClick={() => setShowLayerColorModal(true)} disabled={layers.length === 0}>
                Colors
              </button>
            </>
          )}
        </div>

        <div className={`group file-controls ${showFileOptions ? '' : 'mobile-hidden'}`}>
          {isMobileLayout ? (
            <div className="group mobile-action-row">
              <select
                className="action-select"
                value={mobileFileAction}
                onChange={(event) => setMobileFileAction(event.target.value as MobileFileAction)}
              >
                <option value="save-json">Save JSON</option>
                <option value="load-json">Load JSON</option>
                <option value="import-svg">Import SVG</option>
                <option value="load-preset">Load Preset</option>
                <option value="export-svg">Export SVG</option>
                <option value="export-dxf">Export DXF</option>
                <option value="export-options">Export Options</option>
                <option value="template-repository">Template Repository</option>
                <option value="import-tracing">Import Tracing</option>
                <option value="print-preview">Print Preview</option>
                <option value="undo">Undo</option>
                <option value="redo">Redo</option>
                <option value="copy">Copy Selection</option>
                <option value="paste">Paste</option>
                <option value="delete">Delete Selection</option>
                <option value="toggle-3d">{showThreePreview ? 'Hide 3D Panel' : 'Show 3D Panel'}</option>
                <option value="clear">Clear Document</option>
              </select>
              <button onClick={handleRunMobileFileAction}>Apply</button>
            </div>
          ) : (
            <>
              <button onClick={handleSaveJson}>Save JSON</button>
              <button onClick={() => fileInputRef.current?.click()}>Load JSON</button>
              <button onClick={() => svgInputRef.current?.click()}>Import SVG</button>
              <button onClick={() => handleLoadPreset()}>Load Preset</button>
              <button onClick={handleExportSvg}>Export SVG</button>
              <button onClick={handleExportDxf}>Export DXF</button>
              <button onClick={() => setShowExportOptionsModal(true)}>Export Options</button>
              <button onClick={() => setShowTemplateRepositoryModal(true)}>Templates</button>
              <button onClick={() => tracingInputRef.current?.click()}>Tracing</button>
              <button onClick={() => setShowTracingModal(true)} disabled={tracingOverlays.length === 0}>
                Tracing Controls
              </button>
              <button onClick={() => setShowPrintPreviewModal(true)}>Print Preview</button>
              <button onClick={() => setShowPrintAreas((previous) => !previous)}>
                {showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas'}
              </button>
              <button onClick={() => setShowThreePreview((previous) => !previous)}>
                {showThreePreview ? 'Hide 3D' : 'Show 3D'}
              </button>
              <button onClick={() => resetDocument()}>
                Clear
              </button>
            </>
          )}
        </div>

        <div className={`group meta ${showMeta ? '' : 'mobile-hidden'}`}>
          <span>{Math.round(viewport.scale * 100)}% zoom</span>
          <span>{visibleShapes.length}/{shapes.length} visible shapes</span>
          <span>{layers.length} layers</span>
          <span>{lineTypes.filter((lineType) => lineType.visible).length}/{lineTypes.length} line types</span>
          <span>{foldLines.length} bends</span>
          <span>{stitchHoles.length} stitch holes</span>
          <span>{tracingOverlays.length} traces</span>
          <span>{templateRepository.length} templates</span>
        </div>
      </header>

      <main className={workspaceClassName}>
        <section className={`canvas-pane ${hideCanvasPane ? 'panel-hidden' : ''}`}>
          <svg
            ref={svgRef}
            className="canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
          >
            <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
              {gridLines}

              {tracingOverlays
                .filter((overlay) => overlay.visible)
                .map((overlay) => {
                  const scale = Number(overlay.scale.toFixed(4))
                  const transform = `translate(${round(overlay.offsetX)} ${round(overlay.offsetY)}) rotate(${round(
                    overlay.rotationDeg,
                  )}) scale(${scale})`
                  const x = round(-overlay.width / 2)
                  const y = round(-overlay.height / 2)
                  if (overlay.kind === 'image') {
                    return (
                      <g key={overlay.id} transform={transform} opacity={overlay.opacity}>
                        <image
                          href={overlay.sourceUrl}
                          x={x}
                          y={y}
                          width={round(overlay.width)}
                          height={round(overlay.height)}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      </g>
                    )
                  }

                  return (
                    <g key={overlay.id} transform={transform} opacity={overlay.opacity}>
                      <rect
                        x={x}
                        y={y}
                        width={round(overlay.width)}
                        height={round(overlay.height)}
                        fill={themeMode === 'light' ? '#dbeafe' : '#1e293b'}
                        stroke={themeMode === 'light' ? '#1d4ed8' : '#93c5fd'}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                      />
                      <text
                        x={round(0)}
                        y={round(0)}
                        textAnchor="middle"
                        className="tracing-pdf-label"
                      >
                        PDF Trace
                      </text>
                    </g>
                  )
                })}

              {showPrintAreas &&
                printPlan &&
                printPlan.tiles.map((tile) => (
                  <g key={tile.id} className="print-area-group">
                    <rect
                      x={tile.minX}
                      y={tile.minY}
                      width={tile.width}
                      height={tile.height}
                      className="print-area-rect"
                    />
                    <text x={tile.minX + 8} y={tile.minY + 16} className="print-area-label">
                      {`P${tile.row + 1}-${tile.col + 1}`}
                    </text>
                  </g>
                ))}

              {visibleShapes.map((shape) => {
                const lineType = lineTypesById[shape.lineTypeId]
                const lineTypeRole = lineType?.role ?? 'cut'
                const isSelected = selectedShapeIdSet.has(shape.id)
                const layerStroke =
                  lineTypeRole === 'stitch'
                    ? stitchStrokeColor
                    : lineTypeRole === 'fold'
                      ? foldStrokeColor
                      : lineType?.color ?? displayLayerColorsById[shape.layerId] ?? fallbackLayerStroke
                const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
                if (shape.type === 'line') {
                  return (
                    <line
                      key={shape.id}
                      x1={shape.start.x}
                      y1={shape.start.y}
                      x2={shape.end.x}
                      y2={shape.end.y}
                      className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                      style={{ stroke: layerStroke, strokeDasharray }}
                      onPointerDown={(event) => handleShapePointerDown(event, shape.id)}
                    />
                  )
                }

                if (shape.type === 'arc') {
                  return (
                    <path
                      key={shape.id}
                      d={arcPath(shape.start, shape.mid, shape.end)}
                      className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                      style={{ stroke: layerStroke, strokeDasharray }}
                      onPointerDown={(event) => handleShapePointerDown(event, shape.id)}
                    />
                  )
                }

                return (
                  <path
                    key={shape.id}
                    d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(
                      shape.control.y,
                    )} ${round(shape.end.x)} ${round(shape.end.y)}`}
                    className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                    style={{ stroke: layerStroke, strokeDasharray }}
                    onPointerDown={(event) => handleShapePointerDown(event, shape.id)}
                  />
                )
              })}

              {visibleStitchHoles.map((stitchHole) => {
                const isSelected = stitchHole.id === selectedStitchHoleId
                if (stitchHole.holeType === 'slit') {
                  const radians = (stitchHole.angleDeg * Math.PI) / 180
                  const dx = Math.cos(radians) * 3
                  const dy = Math.sin(radians) * 3
                  return (
                    <line
                      key={stitchHole.id}
                      x1={stitchHole.point.x - dx}
                      y1={stitchHole.point.y - dy}
                      x2={stitchHole.point.x + dx}
                      y2={stitchHole.point.y + dy}
                      className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
                      onPointerDown={(event) => handleStitchHolePointerDown(event, stitchHole.id)}
                    />
                  )
                }

                return (
                  <g key={stitchHole.id}>
                    <circle
                      cx={stitchHole.point.x}
                      cy={stitchHole.point.y}
                      r={2.2}
                      className={isSelected ? 'stitch-hole-dot stitch-hole-dot-selected' : 'stitch-hole-dot'}
                      onPointerDown={(event) => handleStitchHolePointerDown(event, stitchHole.id)}
                    />
                    {showStitchSequenceLabels && (
                      <text
                        x={stitchHole.point.x + 3.2}
                        y={stitchHole.point.y - 3.2}
                        className="stitch-hole-sequence-label"
                      >
                        {stitchHole.sequence + 1}
                      </text>
                    )}
                  </g>
                )
              })}

              {foldLines.map((foldLine) => (
                <line
                  key={foldLine.id}
                  x1={foldLine.start.x}
                  y1={foldLine.start.y}
                  x2={foldLine.end.x}
                  y2={foldLine.end.y}
                  className="fold-line"
                />
              ))}

              {previewElement}
            </g>
          </svg>

          {showLayerLegend && (
            <div className="legend-stack">
              <div
                className="legend-panel legend-single"
                aria-label={legendMode === 'layer' ? 'Layer order legend' : 'Stack height legend'}
              >
                <div className="layer-legend-header">
                  <span>{legendMode === 'layer' ? 'Layer Legend' : 'Stack Legend'}</span>
                  <span>{legendMode === 'layer' ? 'Front -&gt; Back' : 'Height'}</span>
                </div>
                <div className="legend-mode-tabs" role="tablist" aria-label="Legend mode">
                  <button
                    className={legendMode === 'layer' ? 'active' : ''}
                    onClick={() => setLegendMode('layer')}
                    aria-pressed={legendMode === 'layer'}
                  >
                    Layer
                  </button>
                  <button
                    className={legendMode === 'stack' ? 'active' : ''}
                    onClick={() => setLegendMode('stack')}
                    aria-pressed={legendMode === 'stack'}
                  >
                    Stack
                  </button>
                </div>

                {legendMode === 'layer' ? (
                  <>
                    <div className="layer-legend-items">
                      {layers.map((layer, index) => (
                        <div key={layer.id} className="layer-legend-item">
                          <span
                            className="layer-legend-swatch"
                            style={{ backgroundColor: layerColorsById[layer.id] ?? fallbackLayerStroke }}
                          />
                          <span className="layer-legend-label">
                            {index + 1}. {layer.name}
                            {layer.visible ? '' : ' (hidden)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="stack-legend-items">
                    {stackLegendEntries.map((entry) => (
                      <div key={`stack-${entry.stackLevel}`} className="stack-legend-item">
                        <span className="layer-legend-swatch" style={{ backgroundColor: entry.color }} />
                        <span className="stack-level-chip">{`z${entry.stackLevel}`}</span>
                        <span className="stack-level-label">{entry.layerNames.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="legend-key-list">
                  <div className="legend-key-item">
                    <span className="layer-legend-swatch" style={{ backgroundColor: stitchStrokeColor }} />
                    <span>Stitch lines</span>
                  </div>
                  <div className="legend-key-item">
                    <span className="layer-legend-swatch" style={{ backgroundColor: foldStrokeColor }} />
                    <span>Bend lines / areas</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {showThreePreview && (
          <aside
            className={`preview-pane ${hidePreviewPane ? 'panel-hidden' : ''} ${
              isMobileLayout && mobileViewMode === 'split' ? 'preview-pane-mobile-split' : ''
            }`}
          >
            <ThreePreviewPanel
              key={isMobileLayout ? 'mobile-preview' : 'desktop-preview'}
              shapes={visibleShapes}
              stitchHoles={visibleStitchHoles}
              foldLines={foldLines}
              layers={layers}
              lineTypes={lineTypes}
              themeMode={themeMode}
              isMobileLayout={isMobileLayout}
              onUpdateFoldLine={(foldLineId, angleDeg) =>
                setFoldLines((previous) =>
                  previous.map((foldLine) =>
                    foldLine.id === foldLineId
                      ? {
                          ...foldLine,
                          angleDeg,
                        }
                      : foldLine,
                  ),
                )
              }
            />
          </aside>
        )}
      </main>

      <LineTypePalette
        open={showLineTypePalette}
        lineTypes={lineTypes}
        activeLineType={activeLineType}
        shapeCountsByLineType={shapeCountsByLineType}
        selectedShapeCount={selectedShapeCount}
        onClose={() => setShowLineTypePalette(false)}
        onSetActiveLineTypeId={setActiveLineTypeId}
        onToggleLineTypeVisibility={(lineTypeId) =>
          setLineTypes((previous) =>
            previous.map((lineType) =>
              lineType.id === lineTypeId
                ? {
                    ...lineType,
                    visible: !lineType.visible,
                  }
                : lineType,
            ),
          )
        }
        onShowAllTypes={handleShowAllLineTypes}
        onIsolateActiveType={handleIsolateActiveLineType}
        onUpdateActiveLineTypeRole={handleUpdateActiveLineTypeRole}
        onUpdateActiveLineTypeStyle={handleUpdateActiveLineTypeStyle}
        onUpdateActiveLineTypeColor={handleUpdateActiveLineTypeColor}
        onSelectShapesByActiveType={handleSelectShapesByActiveLineType}
        onAssignSelectedToActiveType={handleAssignSelectedToActiveLineType}
        onClearSelection={handleClearShapeSelection}
      />

      {showLayerColorModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowLayerColorModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowLayerColorModal(false)
            }
          }}
          role="presentation"
        >
          <div className="layer-color-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="layer-color-modal-header">
              <h2>Layer Color Settings</h2>
              <button onClick={() => setShowLayerColorModal(false)}>Done</button>
            </div>

            <p className="hint">Layer 1 is treated as front. Lower rows move toward back.</p>

            <div className="layer-color-range">
              <label className="field-row">
                <span>Front color</span>
                <input
                  type="color"
                  value={frontLayerColor}
                  onChange={(event) =>
                    setFrontLayerColor(normalizeHexColor(event.target.value, DEFAULT_FRONT_LAYER_COLOR))
                  }
                />
              </label>
              <label className="field-row">
                <span>Back color</span>
                <input
                  type="color"
                  value={backLayerColor}
                  onChange={(event) =>
                    setBackLayerColor(normalizeHexColor(event.target.value, DEFAULT_BACK_LAYER_COLOR))
                  }
                />
              </label>
            </div>

            <div
              className="layer-color-gradient-preview"
              style={{
                background: `linear-gradient(90deg, ${frontLayerColor}, ${backLayerColor})`,
              }}
            />

            <div className="layer-color-list">
              {layers.map((layer, index) => {
                const color = layerColorsById[layer.id] ?? DEFAULT_FRONT_LAYER_COLOR
                const hasOverride = layer.id in layerColorOverrides
                return (
                  <div key={layer.id} className="layer-color-item">
                    <span className="layer-color-order">{index + 1}</span>
                    <span className="layer-color-name">{layer.name}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => handleSetLayerColorOverride(layer.id, event.target.value)}
                    />
                    <button
                      onClick={() => handleClearLayerColorOverride(layer.id)}
                      disabled={!hasOverride}
                      title={hasOverride ? 'Remove custom color override' : 'Using continuum color'}
                    >
                      Auto
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="layer-color-modal-actions">
              <button onClick={handleResetLayerColors}>Reset Colors</button>
            </div>
          </div>
        </div>
      )}

      {showExportOptionsModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowExportOptionsModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowExportOptionsModal(false)
            }
          }}
          role="presentation"
        >
          <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="layer-color-modal-header">
              <h2>Export Options</h2>
              <button onClick={() => setShowExportOptionsModal(false)}>Done</button>
            </div>

            <p className="hint">Applies to both SVG and DXF exports.</p>

            <div className="control-block">
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={exportOnlyVisibleLineTypes}
                  onChange={(event) => setExportOnlyVisibleLineTypes(event.target.checked)}
                />
                <span>Export only visible line types</span>
              </label>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={exportForceSolidStrokes}
                  onChange={(event) => setExportForceSolidStrokes(event.target.checked)}
                />
                <span>Convert dashed/dotted to solid on export</span>
              </label>
            </div>

            <div className="control-block">
              <h3>Line Type Roles ({activeExportRoleCount} enabled)</h3>
              <div className="export-role-grid">
                {(['cut', 'stitch', 'fold', 'guide', 'mark'] as const).map((role) => (
                  <label key={role} className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={exportRoleFilters[role]}
                      onChange={(event) =>
                        setExportRoleFilters((previous) => ({
                          ...previous,
                          [role]: event.target.checked,
                        }))
                      }
                    />
                    <span>{role[0].toUpperCase() + role.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="control-block">
              <h3>DXF</h3>
              <label className="field-row">
                <span>Version</span>
                <select
                  className="action-select"
                  value={dxfVersion}
                  onChange={(event) => setDxfVersion(event.target.value as DxfVersion)}
                >
                  <option value="r12">R12 (AC1009)</option>
                  <option value="r14">R14 (AC1014)</option>
                </select>
              </label>
              <label className="layer-toggle-item">
                <input type="checkbox" checked={dxfFlipY} onChange={(event) => setDxfFlipY(event.target.checked)} />
                <span>Flip Y axis on DXF export</span>
              </label>
            </div>

            <div className="line-type-modal-actions">
              <button
                onClick={() => {
                  setExportOnlyVisibleLineTypes(true)
                  setExportRoleFilters({ ...DEFAULT_EXPORT_ROLE_FILTERS })
                  setExportForceSolidStrokes(false)
                  setDxfFlipY(false)
                  setDxfVersion('r12')
                }}
              >
                Reset Export Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateRepositoryModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowTemplateRepositoryModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowTemplateRepositoryModal(false)
            }
          }}
          role="presentation"
        >
          <div className="line-type-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="line-type-modal-header">
              <h2>Template Repository</h2>
              <button onClick={() => setShowTemplateRepositoryModal(false)}>Done</button>
            </div>
            <p className="hint">Save reusable patterns, import/export catalogs, or insert template pieces into the current document.</p>
            <div className="line-type-modal-actions">
              <button onClick={handleSaveTemplateToRepository}>Save Current as Template</button>
              <button onClick={handleExportTemplateRepository} disabled={templateRepository.length === 0}>
                Export Repository
              </button>
              <button onClick={() => templateImportInputRef.current?.click()}>Import Repository</button>
            </div>

            <div className="template-list">
              {templateRepository.length === 0 ? (
                <p className="hint">No templates saved yet.</p>
              ) : (
                templateRepository.map((entry) => (
                  <label key={entry.id} className="template-item">
                    <input
                      type="radio"
                      name="template-entry"
                      checked={selectedTemplateEntryId === entry.id}
                      onChange={() => setSelectedTemplateEntryId(entry.id)}
                    />
                    <span className="template-item-name">{entry.name}</span>
                    <span className="template-item-meta">
                      {entry.doc.objects.length} shapes, {entry.doc.layers.length} layers
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="line-type-modal-actions">
              <button onClick={handleLoadTemplateAsDocument} disabled={!selectedTemplateEntry}>
                Load as Document
              </button>
              <button onClick={handleInsertTemplateIntoDocument} disabled={!selectedTemplateEntry}>
                Insert into Current
              </button>
              <button
                onClick={() => selectedTemplateEntry && handleDeleteTemplateFromRepository(selectedTemplateEntry.id)}
                disabled={!selectedTemplateEntry}
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showTracingModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowTracingModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowTracingModal(false)
            }
          }}
          role="presentation"
        >
          <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="layer-color-modal-header">
              <h2>Tracing Overlays</h2>
              <button onClick={() => setShowTracingModal(false)}>Done</button>
            </div>
            <div className="line-type-modal-actions">
              <button onClick={() => tracingInputRef.current?.click()}>Import Image/PDF</button>
              <button
                onClick={() => activeTracingOverlay && handleDeleteTracingOverlay(activeTracingOverlay.id)}
                disabled={!activeTracingOverlay}
              >
                Delete Active
              </button>
            </div>

            <label className="field-row">
              <span>Active tracing</span>
              <select
                className="action-select"
                value={activeTracingOverlay?.id ?? ''}
                onChange={(event) => setActiveTracingOverlayId(event.target.value || null)}
              >
                {tracingOverlays.map((overlay) => (
                  <option key={overlay.id} value={overlay.id}>
                    {overlay.name} [{overlay.kind}]
                  </option>
                ))}
              </select>
            </label>

            {activeTracingOverlay ? (
              <div className="control-block">
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={activeTracingOverlay.visible}
                    onChange={(event) =>
                      handleUpdateTracingOverlay(activeTracingOverlay.id, { visible: event.target.checked })
                    }
                  />
                  <span>Visible</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={activeTracingOverlay.locked}
                    onChange={(event) =>
                      handleUpdateTracingOverlay(activeTracingOverlay.id, { locked: event.target.checked })
                    }
                  />
                  <span>Lock editing</span>
                </label>
                <label className="field-row">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={activeTracingOverlay.opacity}
                    onChange={(event) =>
                      handleUpdateTracingOverlay(activeTracingOverlay.id, {
                        opacity: clamp(Number(event.target.value), 0.05, 1),
                      })
                    }
                  />
                </label>
                <label className="field-row">
                  <span>Scale</span>
                  <input
                    type="number"
                    min={0.05}
                    max={20}
                    step={0.05}
                    value={activeTracingOverlay.scale}
                    onChange={(event) =>
                      handleUpdateTracingOverlay(activeTracingOverlay.id, {
                        scale: clamp(Number(event.target.value) || 1, 0.05, 20),
                      })
                    }
                  />
                </label>
                <label className="field-row">
                  <span>Rotation (deg)</span>
                  <input
                    type="number"
                    step={1}
                    value={activeTracingOverlay.rotationDeg}
                    onChange={(event) =>
                      handleUpdateTracingOverlay(activeTracingOverlay.id, {
                        rotationDeg: Number(event.target.value) || 0,
                      })
                    }
                  />
                </label>
                <div className="line-type-edit-grid">
                  <label className="field-row">
                    <span>Offset X</span>
                    <input
                      type="number"
                      step={1}
                      value={activeTracingOverlay.offsetX}
                      disabled={activeTracingOverlay.locked}
                      onChange={(event) =>
                        handleUpdateTracingOverlay(activeTracingOverlay.id, {
                          offsetX: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="field-row">
                    <span>Offset Y</span>
                    <input
                      type="number"
                      step={1}
                      value={activeTracingOverlay.offsetY}
                      disabled={activeTracingOverlay.locked}
                      onChange={(event) =>
                        handleUpdateTracingOverlay(activeTracingOverlay.id, {
                          offsetY: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : (
              <p className="hint">Import a tracing file to begin.</p>
            )}
          </div>
        </div>
      )}

      {showPrintPreviewModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPrintPreviewModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowPrintPreviewModal(false)
            }
          }}
          role="presentation"
        >
          <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="layer-color-modal-header">
              <h2>Print Preview + Tiling</h2>
              <button onClick={() => setShowPrintPreviewModal(false)}>Done</button>
            </div>
            <p className="hint">Matches source-style preview settings: tiling, overlap, calibration scale, selection-only, rulers, and color controls.</p>

            <div className="line-type-edit-grid">
              <label className="field-row">
                <span>Paper</span>
                <select
                  className="action-select"
                  value={printPaper}
                  onChange={(event) => setPrintPaper(event.target.value as PrintPaper)}
                >
                  <option value="letter">Letter (216 x 279mm)</option>
                  <option value="a4">A4 (210 x 297mm)</option>
                </select>
              </label>
              <label className="field-row">
                <span>Scale (%)</span>
                <input
                  type="number"
                  min={1}
                  max={400}
                  value={printScalePercent}
                  onChange={(event) => setPrintScalePercent(clamp(Number(event.target.value) || 100, 1, 400))}
                />
              </label>
              <label className="field-row">
                <span>Tile X</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={printTileX}
                  onChange={(event) => setPrintTileX(clamp(Number(event.target.value) || 1, 1, 25))}
                />
              </label>
              <label className="field-row">
                <span>Tile Y</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={printTileY}
                  onChange={(event) => setPrintTileY(clamp(Number(event.target.value) || 1, 1, 25))}
                />
              </label>
              <label className="field-row">
                <span>Overlap (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={printOverlapMm}
                  onChange={(event) => setPrintOverlapMm(clamp(Number(event.target.value) || 0, 0, 30))}
                />
              </label>
              <label className="field-row">
                <span>Margin (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={printMarginMm}
                  onChange={(event) => setPrintMarginMm(clamp(Number(event.target.value) || 0, 0, 30))}
                />
              </label>
            </div>

            <div className="control-block">
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={printSelectedOnly}
                  onChange={(event) => setPrintSelectedOnly(event.target.checked)}
                />
                <span>Print selected shapes only</span>
              </label>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={printRulerInside}
                  onChange={(event) => setPrintRulerInside(event.target.checked)}
                />
                <span>Ruler inside page</span>
              </label>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={printInColor}
                  onChange={(event) => setPrintInColor(event.target.checked)}
                />
                <span>Print in color</span>
              </label>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={printStitchAsDots}
                  onChange={(event) => setPrintStitchAsDots(event.target.checked)}
                />
                <span>Render stitch holes as dots</span>
              </label>
            </div>

            {printPlan ? (
              <div className="print-preview-summary">
                <div>Source bounds: {printPlan.sourceBounds.width} x {printPlan.sourceBounds.height} mm</div>
                <div>Coverage: {printPlan.contentWidthMm} x {printPlan.contentHeightMm} mm</div>
                <div>Pages: {printPlan.tiles.length}</div>
                <div>Color: {printInColor ? 'On' : 'Off'} | Ruler: {printRulerInside ? 'Inside' : 'Outside'}</div>
              </div>
            ) : (
              <p className="hint">No shapes available for print preview with current filters.</p>
            )}

            <div className="line-type-modal-actions">
              <button onClick={() => setShowPrintAreas((previous) => !previous)}>
                {showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas'}
              </button>
              <button onClick={handleFitView}>Fit to Content</button>
            </div>
          </div>
        </div>
      )}

      <footer className="statusbar">
        <span>Tool: {toolLabel(tool)}</span>
        <span>{status}</span>
        <span>Tip: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+C/X/V clipboard, Delete removes selection.</span>
        <span>Mobile: use 2D / 3D / Split buttons to focus workspace.</span>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleLoadJson}
      />
      <input
        ref={svgInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden-input"
        onChange={handleImportSvg}
      />
      <input
        ref={tracingInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden-input"
        onChange={handleImportTracing}
      />
      <input
        ref={templateImportInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleImportTemplateRepositoryFile}
      />
    </div>
  )
}

export default App
