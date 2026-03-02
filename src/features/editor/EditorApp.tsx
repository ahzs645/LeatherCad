import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  WheelEvent as ReactWheelEvent,
} from 'react'
import '../../app/styles/App.css'
import {
  arcPath,
  clamp,
  distance,
  getBounds,
  round,
  uid,
} from './cad/cad-geometry'
import type {
  ConstraintAxis,
  ConstraintEdge,
  DocFile,
  FoldLine,
  HardwareKind,
  HardwareMarker,
  Layer,
  LineType,
  ParametricConstraint,
  Point,
  SeamAllowance,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  StitchHoleType,
  TracingOverlay,
  Tool,
  Viewport,
} from './cad/cad-types'
import { LineTypePalette } from './components/LineTypePalette'
import { StitchHolePanel } from './components/StitchHolePanel'
import { ThreePreviewPanel } from './components/ThreePreviewPanel'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
  lineTypeStrokeDasharray,
  normalizeLineTypes,
  resolveActiveLineTypeId,
} from './cad/line-types'
import { applyLineTypeToShapeIds } from './ops/line-type-ops'
import {
  createStitchHole,
  deleteStitchHolesForShapes,
  fixStitchHoleOrderFromHole,
  findNearestStitchAnchor,
  generateFixedPitchStitchHoles,
  generateVariablePitchStitchHoles,
  normalizeStitchHoleSequences,
  resequenceStitchHolesOnShape,
  selectNextStitchHole,
} from './ops/stitch-hole-ops'
import { importSvgAsShapes } from './io/io-svg'
import { buildDxfFromShapes } from './io/io-dxf'
import { buildPdfFromShapes } from './io/io-pdf'
import { DEFAULT_PRESET_ID, PRESET_DOCS } from './data/sample-doc'
import { applyRedo, applyUndo, deepClone, pushHistorySnapshot, type HistoryState } from './ops/history-ops'
import type { PrintPaper } from './preview/print-preview'
import {
  createTemplateFromDoc,
  insertTemplateDocIntoCurrent,
  loadTemplateRepository,
  parseTemplateRepositoryImport,
  saveTemplateRepository,
  serializeTemplateRepository,
  type TemplateRepositoryEntry,
} from './templates/template-repository'
import {
  copySelectionToClipboard,
  moveSelectionByOneStep,
  moveSelectionToEdge,
  pasteClipboardPayload,
  type ClipboardPayload,
} from './ops/shape-selection-ops'
import {
  alignSelectedShapes,
  alignSelectedShapesToGrid,
  applyParametricConstraints,
  snapPointToContext,
  translateShape,
} from './ops/pattern-ops'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from './ops/fold-line-ops'

import {
  CLIPBOARD_PASTE_OFFSET,
  DEFAULT_BACK_LAYER_COLOR,
  DEFAULT_EXPORT_ROLE_FILTERS,
  DEFAULT_FRONT_LAYER_COLOR,
  DEFAULT_SEAM_ALLOWANCE_MM,
  DEFAULT_SNAP_SETTINGS,
  DESKTOP_RIBBON_TABS,
  GRID_EXTENT,
  GRID_STEP,
  HARDWARE_PRESETS,
  HISTORY_LIMIT,
  MAX_ZOOM,
  MIN_ZOOM,
  MOBILE_MEDIA_QUERY,
  MOBILE_OPTIONS_TABS,
  SUB_SKETCH_COPY_OFFSET_MM,
  TOOL_OPTIONS,
} from './editor-constants'
import {
  parseSnapSettings,
  sanitizeFoldLine,
} from './editor-parsers'
import type {
  DesktopRibbonTab,
  DxfVersion,
  EditorSnapshot,
  ExportRoleFilters,
  LegendMode,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  ThemeMode,
} from './editor-types'
import {
  createDefaultLayer,
  downloadFile,
  newLayerName,
  newSketchGroupName,
  normalizeHexColor,
  toolLabel,
} from './editor-utils'
import { useEditorDerivedState } from './hooks/useEditorDerivedState'
import { parseImportedJsonDocument } from './editor-json-import'

export function EditorApp() {
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
  const [sketchGroups, setSketchGroups] = useState<SketchGroup[]>([])
  const [activeSketchGroupId, setActiveSketchGroupId] = useState<string | null>(null)
  const [constraints, setConstraints] = useState<ParametricConstraint[]>([])
  const [seamAllowances, setSeamAllowances] = useState<SeamAllowance[]>([])
  const [hardwareMarkers, setHardwareMarkers] = useState<HardwareMarker[]>([])
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS)
  const [showAnnotations, setShowAnnotations] = useState(true)
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
  const [desktopRibbonTab, setDesktopRibbonTab] = useState<DesktopRibbonTab>('build')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [showLayerColorModal, setShowLayerColorModal] = useState(false)
  const [showLineTypePalette, setShowLineTypePalette] = useState(false)
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false)
  const [exportOnlySelectedShapes, setExportOnlySelectedShapes] = useState(false)
  const [exportOnlyVisibleLineTypes, setExportOnlyVisibleLineTypes] = useState(true)
  const [exportRoleFilters, setExportRoleFilters] = useState<ExportRoleFilters>({ ...DEFAULT_EXPORT_ROLE_FILTERS })
  const [exportForceSolidStrokes, setExportForceSolidStrokes] = useState(false)
  const [dxfFlipY, setDxfFlipY] = useState(false)
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('r12')
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [selectedStitchHoleId, setSelectedStitchHoleId] = useState<string | null>(null)
  const [selectedHardwareMarkerId, setSelectedHardwareMarkerId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [showTracingModal, setShowTracingModal] = useState(false)
  const [showPatternToolsModal, setShowPatternToolsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
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
  const [seamAllowanceInputMm, setSeamAllowanceInputMm] = useState(DEFAULT_SEAM_ALLOWANCE_MM)
  const [constraintEdge, setConstraintEdge] = useState<ConstraintEdge>('left')
  const [constraintOffsetMm, setConstraintOffsetMm] = useState(10)
  const [constraintAxis, setConstraintAxis] = useState<ConstraintAxis>('x')
  const [hardwarePreset, setHardwarePreset] = useState<HardwareKind>('snap')
  const [customHardwareDiameterMm, setCustomHardwareDiameterMm] = useState(4)
  const [customHardwareSpacingMm, setCustomHardwareSpacingMm] = useState(0)
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
  const {
    activeLayer,
    sketchGroupsById,
    activeSketchGroup,
    activeLineType,
    lineTypesById,
    shapesById,
    selectedShapeIdSet,
    shapeCountsByLineType,
    stitchHoleCountsByShape,
    selectedShapeCount,
    selectedStitchHoleCount,
    selectedStitchHole,
    selectedHardwareMarker,
    activeTracingOverlay,
    selectedTemplateEntry,
    canUndo,
    canRedo,
    visibleShapes,
    visibleStitchHoles,
    visibleLayerIdSet,
    visibleHardwareMarkers,
    seamGuides,
    annotationLabels,
    lineTypeStylesById,
    printPlan,
    activeExportRoleCount,
    layerColorsById,
    layerStackLevels,
    stackLegendEntries,
    displayLayerColorsById,
    fallbackLayerStroke,
    cutStrokeColor,
    stitchStrokeColor,
    foldStrokeColor,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
    currentSnapshot,
    currentSnapshotSignature,
  } = useEditorDerivedState({
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    lineTypes,
    activeLineTypeId,
    shapes,
    foldLines,
    stitchHoles,
    constraints,
    seamAllowances,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    activeTracingOverlayId,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    templateRepository,
    selectedTemplateEntryId,
    historyState,
    printSelectedOnly,
    printPaper,
    printMarginMm,
    printOverlapMm,
    printTileX,
    printTileY,
    printScalePercent,
    exportRoleFilters,
    frontLayerColor,
    backLayerColor,
    layerColorOverrides,
    legendMode,
    themeMode,
  })

  const applyEditorSnapshot = (snapshot: EditorSnapshot) => {
    setLayers(snapshot.layers)
    setActiveLayerId(snapshot.activeLayerId)
    setSketchGroups(snapshot.sketchGroups)
    setActiveSketchGroupId(snapshot.activeSketchGroupId)
    setLineTypes(snapshot.lineTypes)
    setActiveLineTypeId(snapshot.activeLineTypeId)
    setShapes(snapshot.shapes)
    setFoldLines(snapshot.foldLines)
    setStitchHoles(snapshot.stitchHoles)
    setConstraints(snapshot.constraints)
    setSeamAllowances(snapshot.seamAllowances)
    setHardwareMarkers(snapshot.hardwareMarkers)
    setSnapSettings(snapshot.snapSettings)
    setShowAnnotations(snapshot.showAnnotations)
    setTracingOverlays(snapshot.tracingOverlays)
    setLayerColorOverrides(snapshot.layerColorOverrides)
    setFrontLayerColor(snapshot.frontLayerColor)
    setBackLayerColor(snapshot.backLayerColor)
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
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

  const getSnappedPoint = (point: Point) =>
    snapPointToContext(point, snapSettings, {
      shapes: visibleShapes,
      foldLines,
      hardwareMarkers: visibleHardwareMarkers,
      viewportScale: viewport.scale,
    })

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

    if (activeSketchGroup) {
      if (!activeSketchGroup.visible) {
        setStatus('Active sub-sketch is hidden. Show it before drawing.')
        return false
      }
      if (activeSketchGroup.locked) {
        setStatus('Active sub-sketch is locked. Unlock it before drawing.')
        return false
      }
      if (activeSketchGroup.layerId !== activeLayer.id) {
        setStatus('Active sub-sketch belongs to another layer. Switch layer or clear active sub-sketch.')
        return false
      }
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
    setSketchGroups([])
    setActiveSketchGroupId(null)
    setLineTypes(defaultLineTypes)
    setActiveLineTypeId(DEFAULT_ACTIVE_LINE_TYPE_ID)
    setShapes([])
    setFoldLines([])
    setStitchHoles([])
    setConstraints([])
    setSeamAllowances([])
    setHardwareMarkers([])
    setSnapSettings(DEFAULT_SNAP_SETTINGS)
    setShowAnnotations(true)
    setTracingOverlays([])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
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
    const layerIdSet = new Set(normalizedLayers.map((layer) => layer.id))
    const normalizedSketchGroups = (doc.sketchGroups ?? []).filter((group) => layerIdSet.has(group.layerId))
    const sketchGroupIdSet = new Set(normalizedSketchGroups.map((group) => group.id))
    const normalizedShapes = doc.objects.map((shape) => {
      if (!shape.groupId || !sketchGroupIdSet.has(shape.groupId)) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      const group = normalizedSketchGroups.find((entry) => entry.id === shape.groupId)
      if (!group || group.layerId !== shape.layerId) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      return shape
    })
    const shapeIdSet = new Set(normalizedShapes.map((shape) => shape.id))
    const normalizedConstraints = (doc.constraints ?? []).filter((constraint) => {
      if (!shapeIdSet.has(constraint.shapeId)) {
        return false
      }
      if (constraint.type === 'edge-offset') {
        return layerIdSet.has(constraint.referenceLayerId)
      }
      return shapeIdSet.has(constraint.referenceShapeId)
    })
    const normalizedSeamAllowances = (doc.seamAllowances ?? []).filter((entry) => shapeIdSet.has(entry.shapeId))
    const normalizedHardwareMarkers = (doc.hardwareMarkers ?? []).filter((marker) => {
      if (!layerIdSet.has(marker.layerId)) {
        return false
      }
      if (!marker.groupId) {
        return true
      }
      return sketchGroupIdSet.has(marker.groupId)
    })
    const normalizedActiveSketchGroupId =
      doc.activeSketchGroupId && sketchGroupIdSet.has(doc.activeSketchGroupId) ? doc.activeSketchGroupId : null
    const nextLineTypes = normalizeLineTypes(doc.lineTypes ?? [])
    setLayers(normalizedLayers)
    setActiveLayerId(normalizedActiveLayerId)
    setSketchGroups(normalizedSketchGroups)
    setActiveSketchGroupId(normalizedActiveSketchGroupId)
    setLineTypes(nextLineTypes)
    setActiveLineTypeId(resolveActiveLineTypeId(nextLineTypes, doc.activeLineTypeId))
    setShapes(normalizedShapes)
    setFoldLines(doc.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(doc.stitchHoles ?? []))
    setConstraints(normalizedConstraints)
    setSeamAllowances(normalizedSeamAllowances)
    setHardwareMarkers(normalizedHardwareMarkers)
    setSnapSettings(parseSnapSettings(doc.snapSettings) ?? DEFAULT_SNAP_SETTINGS)
    setShowAnnotations(typeof doc.showAnnotations === 'boolean' ? doc.showAnnotations : true)
    setTracingOverlays(doc.tracingOverlays ?? [])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
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
      if (selectedHardwareMarkerId) {
        setHardwareMarkers((previous) => previous.filter((marker) => marker.id !== selectedHardwareMarkerId))
        setSelectedHardwareMarkerId(null)
        setStatus('Deleted selected hardware marker')
        return
      }
      setStatus('No selected shapes to delete')
      return
    }
    const deleteCount = selectedShapeIdSet.size
    setShapes((previous) => previous.filter((shape) => !selectedShapeIdSet.has(shape.id)))
    setStitchHoles((previous) => previous.filter((hole) => !selectedShapeIdSet.has(hole.shapeId)))
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setConstraints((previous) =>
      previous.filter((entry) => {
        if (selectedShapeIdSet.has(entry.shapeId)) {
          return false
        }
        return entry.type === 'edge-offset' ? true : !selectedShapeIdSet.has(entry.referenceShapeId)
      }),
    )
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setStatus(`Deleted ${deleteCount} selected shape${deleteCount === 1 ? '' : 's'}`)
  }, [selectedShapeIdSet, selectedHardwareMarkerId])

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
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setConstraints((previous) =>
      previous.filter((entry) => {
        if (selectedShapeIdSet.has(entry.shapeId)) {
          return false
        }
        return entry.type === 'edge-offset' ? true : !selectedShapeIdSet.has(entry.referenceShapeId)
      }),
    )
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
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
    sketchGroups,
    activeSketchGroupId,
    lineTypes,
    activeLineTypeId,
    objects: shapes,
    foldLines,
    stitchHoles,
    constraints,
    seamAllowances,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
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
    setActiveSketchGroupId((previous) => {
      if (!previous) {
        return previous
      }
      const match = sketchGroups.find((group) => group.id === previous)
      if (!match) {
        return null
      }
      return match.layerId === activeLayerId ? previous : null
    })
  }, [sketchGroups, activeLayerId])

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
    setSeamAllowances((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const next = previous.filter((entry) => shapeIdSet.has(entry.shapeId))
      return next.length === previous.length ? previous : next
    })
  }, [shapes])

  useEffect(() => {
    setConstraints((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const shapeIdSet = new Set(shapes.map((shape) => shape.id))
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const next = previous.filter((entry) => {
        if (!shapeIdSet.has(entry.shapeId)) {
          return false
        }
        if (entry.type === 'edge-offset') {
          return layerIdSet.has(entry.referenceLayerId)
        }
        return shapeIdSet.has(entry.referenceShapeId)
      })
      return next.length === previous.length ? previous : next
    })
  }, [shapes, layers])

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
    setSelectedHardwareMarkerId((previous) => {
      if (!previous) {
        return previous
      }
      return hardwareMarkers.some((marker) => marker.id === previous) ? previous : null
    })
  }, [hardwareMarkers])

  useEffect(() => {
    setSketchGroups((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const next = previous.filter((group) => layerIdSet.has(group.layerId))
      return next.length === previous.length ? previous : next
    })
  }, [layers])

  useEffect(() => {
    setHardwareMarkers((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const layerIdSet = new Set(layers.map((layer) => layer.id))
      const groupIdSet = new Set(sketchGroups.map((group) => group.id))
      const next = previous.filter((marker) => {
        if (!layerIdSet.has(marker.layerId)) {
          return false
        }
        if (!marker.groupId) {
          return true
        }
        return groupIdSet.has(marker.groupId)
      })
      return next.length === previous.length ? previous : next
    })
  }, [layers, sketchGroups])

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

    const rawPoint = toWorldPoint(event.clientX, event.clientY)
    if (!rawPoint) {
      return
    }
    const snappedPoint = getSnappedPoint(rawPoint)
    const point = snappedPoint.point

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
          groupId: activeSketchGroup?.id,
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

    if (tool === 'hardware') {
      if (!ensureActiveLayerWritable()) {
        return
      }

      const preset = hardwarePreset === 'custom' ? null : HARDWARE_PRESETS[hardwarePreset]
      const marker: HardwareMarker = {
        id: uid(),
        layerId: activeLayerId,
        groupId: activeSketchGroup?.id,
        point,
        kind: hardwarePreset,
        label: hardwarePreset === 'custom' ? 'Hardware' : preset?.label ?? 'Hardware',
        holeDiameterMm:
          hardwarePreset === 'custom'
            ? clamp(customHardwareDiameterMm || 4, 0.1, 120)
            : (preset?.holeDiameterMm ?? 4),
        spacingMm:
          hardwarePreset === 'custom'
            ? clamp(customHardwareSpacingMm || 0, 0, 300)
            : (preset?.spacingMm ?? 0),
        notes: '',
        visible: true,
      }
      setHardwareMarkers((previous) => [...previous, marker])
      setSelectedHardwareMarkerId(marker.id)
      setStatus(`Placed hardware marker (${marker.kind})`)
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
        sanitizeFoldLine({
          id: uid(),
          name: `Fold ${previous.length + 1}`,
          start,
          end: point,
          angleDeg: 0,
          maxAngleDeg: 180,
          direction: DEFAULT_FOLD_DIRECTION,
          radiusMm: DEFAULT_FOLD_RADIUS_MM,
          thicknessMm: DEFAULT_FOLD_THICKNESS_MM,
          neutralAxisRatio: DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
          stiffness: DEFAULT_FOLD_STIFFNESS,
          clearanceMm: DEFAULT_FOLD_CLEARANCE_MM,
        }),
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
          groupId: activeSketchGroup?.id,
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
          groupId: activeSketchGroup?.id,
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
    setSelectedHardwareMarkerId(null)

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
    setSelectedShapeIds([])
    const nextId = selectedStitchHoleId === stitchHoleId ? null : stitchHoleId
    setSelectedStitchHoleId(nextId)
    setStatus(nextId ? `Stitch hole ${stitchHole.sequence + 1} selected` : 'Stitch-hole selection cleared')
  }

  const handleHardwarePointerDown = (event: ReactPointerEvent<SVGGElement>, markerId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const marker = hardwareMarkers.find((entry) => entry.id === markerId)
    if (!marker) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    const nextId = selectedHardwareMarkerId === markerId ? null : markerId
    setSelectedHardwareMarkerId(nextId)
    setStatus(nextId ? `Hardware marker selected: ${marker.label}` : 'Hardware marker selection cleared')
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

    if (draftPoints.length === 0 && tool !== 'hardware') {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      setCursorPoint(getSnappedPoint(point).point)
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
      if (exportOnlySelectedShapes && !selectedShapeIdSet.has(shape.id)) {
        return false
      }
      if (!visibleLayerIdSet.has(shape.layerId)) {
        return false
      }
      if (shape.groupId) {
        const group = sketchGroupsById[shape.groupId]
        if (group && !group.visible) {
          return false
        }
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

  const handleExportPdf = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const pdf = buildPdfFromShapes(exportShapes, {
      forceSolidLineStyle: exportForceSolidStrokes,
      lineTypeStyles: lineTypeStylesById,
      lineTypeColors: Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType.color])),
    })

    downloadFile('leathercraft-export.pdf', pdf, 'application/pdf')
    setStatus(`Exported PDF (${exportShapes.length} shapes)`)
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
      const imported = parseImportedJsonDocument(raw)
      applyLoadedDocument(
        imported.doc,
        `Loaded JSON (${imported.summary.shapeCount} shapes, ${imported.summary.foldCount} folds, ${imported.summary.stitchHoleCount} holes, ${imported.summary.layerCount} layers, ${imported.summary.hardwareMarkerCount} hardware markers)`,
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
      setShapes((previous) => [
        ...previous,
        ...imported.shapes.map((shape) => ({
          ...shape,
          groupId: activeSketchGroup?.id,
        })),
      ])
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
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.layerId === deleteLayerId
          ? {
              ...group,
              layerId: fallbackLayer.id,
            }
          : group,
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.layerId === deleteLayerId
          ? {
              ...marker,
              layerId: fallbackLayer.id,
            }
          : marker,
      ),
    )
    setConstraints((previous) =>
      previous.map((constraint) =>
        constraint.type === 'edge-offset' && constraint.referenceLayerId === deleteLayerId
          ? {
              ...constraint,
              referenceLayerId: fallbackLayer.id,
            }
          : constraint,
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

  const handleCreateSketchGroupFromSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to create a sub-sketch')
      return
    }

    if (!activeLayer) {
      setStatus('No active layer for sub-sketch creation')
      return
    }

    const nextGroupId = uid()
    const nextGroup: SketchGroup = {
      id: nextGroupId,
      name: newSketchGroupName(sketchGroups.length),
      layerId: activeLayer.id,
      visible: true,
      locked: false,
    }

    setSketchGroups((previous) => [...previous, nextGroup])
    setShapes((previous) =>
      previous.map((shape) =>
        selectedShapeIdSet.has(shape.id)
          ? {
              ...shape,
              groupId: nextGroupId,
            }
          : shape,
      ),
    )
    setActiveSketchGroupId(nextGroupId)
    setStatus(`Created sub-sketch "${nextGroup.name}"`)
  }

  const handleRenameActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to rename')
      return
    }

    const nextName = window.prompt('Sub-sketch name', activeSketchGroup.name)?.trim()
    if (!nextName) {
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              name: nextName,
            }
          : group,
      ),
    )
    setStatus(`Renamed sub-sketch to "${nextName}"`)
  }

  const handleToggleActiveSketchGroupVisibility = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to update')
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              visible: !group.visible,
            }
          : group,
      ),
    )
    setStatus(activeSketchGroup.visible ? 'Active sub-sketch hidden' : 'Active sub-sketch shown')
  }

  const handleToggleActiveSketchGroupLock = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to update')
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              locked: !group.locked,
            }
          : group,
      ),
    )
    setStatus(activeSketchGroup.locked ? 'Active sub-sketch unlocked' : 'Active sub-sketch locked')
  }

  const handleClearActiveSketchGroup = () => {
    setActiveSketchGroupId(null)
    setStatus('Active sub-sketch cleared')
  }

  const handleDeleteActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to delete')
      return
    }

    const deleteGroupId = activeSketchGroup.id
    setSketchGroups((previous) => previous.filter((group) => group.id !== deleteGroupId))
    setShapes((previous) =>
      previous.map((shape) =>
        shape.groupId === deleteGroupId
          ? {
              ...shape,
              groupId: undefined,
            }
          : shape,
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.groupId === deleteGroupId
          ? {
              ...marker,
              groupId: undefined,
            }
          : marker,
      ),
    )
    setActiveSketchGroupId(null)
    setStatus('Deleted active sub-sketch')
  }

  const handleDuplicateActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to place')
      return
    }

    const sourceShapes = shapes.filter((shape) => shape.groupId === activeSketchGroup.id)
    if (sourceShapes.length === 0) {
      setStatus('Active sub-sketch has no shapes to place')
      return
    }

    const shapeIdMap = new Map<string, string>()
    const duplicatedShapes = sourceShapes.map((shape) => {
      const nextId = uid()
      shapeIdMap.set(shape.id, nextId)
      return {
        ...translateShape(shape, SUB_SKETCH_COPY_OFFSET_MM, SUB_SKETCH_COPY_OFFSET_MM),
        id: nextId,
      }
    })
    const duplicatedShapeIds = new Set(duplicatedShapes.map((shape) => shape.id))
    const duplicatedHoles = stitchHoles
      .filter((hole) => shapeIdMap.has(hole.shapeId))
      .map((hole) => ({
        ...hole,
        id: uid(),
        shapeId: shapeIdMap.get(hole.shapeId) ?? hole.shapeId,
        point: {
          x: hole.point.x + SUB_SKETCH_COPY_OFFSET_MM,
          y: hole.point.y + SUB_SKETCH_COPY_OFFSET_MM,
        },
      }))
    const duplicatedSeamAllowances = seamAllowances
      .filter((entry) => shapeIdMap.has(entry.shapeId))
      .map((entry) => ({
        ...entry,
        id: uid(),
        shapeId: shapeIdMap.get(entry.shapeId) ?? entry.shapeId,
      }))
    const duplicatedHardware = hardwareMarkers
      .filter((marker) => marker.groupId === activeSketchGroup.id)
      .map((marker) => ({
        ...marker,
        id: uid(),
        point: {
          x: marker.point.x + SUB_SKETCH_COPY_OFFSET_MM,
          y: marker.point.y + SUB_SKETCH_COPY_OFFSET_MM,
        },
      }))

    setShapes((previous) => [...previous, ...duplicatedShapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...duplicatedHoles]))
    setSeamAllowances((previous) => [...previous, ...duplicatedSeamAllowances])
    setHardwareMarkers((previous) => [...previous, ...duplicatedHardware])
    setSelectedShapeIds(Array.from(duplicatedShapeIds))
    setStatus(`Placed ${duplicatedShapes.length} copied sub-sketch shape${duplicatedShapes.length === 1 ? '' : 's'}`)
  }

  const handleSetActiveLayerAnnotation = (value: string) => {
    if (!activeLayer) {
      return
    }
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              annotation: value,
            }
          : layer,
      ),
    )
  }

  const handleSetActiveSketchAnnotation = (value: string) => {
    if (!activeSketchGroup) {
      return
    }
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              annotation: value,
            }
          : group,
      ),
    )
  }

  const handleAddEdgeConstraintFromSelection = () => {
    if (!activeLayer) {
      setStatus('No active layer available for edge constraint')
      return
    }

    const firstShapeId = selectedShapeIds[0]
    if (!firstShapeId) {
      setStatus('Select a shape to add an edge-offset constraint')
      return
    }

    const nextConstraint: ParametricConstraint = {
      id: uid(),
      name: `Edge offset ${constraints.length + 1}`,
      type: 'edge-offset',
      enabled: true,
      shapeId: firstShapeId,
      referenceLayerId: activeLayer.id,
      edge: constraintEdge,
      anchor: 'center',
      offsetMm: clamp(constraintOffsetMm, 0, 999),
    }
    setConstraints((previous) => [...previous, nextConstraint])
    setStatus('Edge-offset constraint added')
  }

  const handleAddAlignConstraintsFromSelection = () => {
    if (selectedShapeIds.length < 2) {
      setStatus('Select at least two shapes to add alignment constraints')
      return
    }

    const referenceShapeId = selectedShapeIds[0]
    const nextConstraints: ParametricConstraint[] = selectedShapeIds.slice(1).map((shapeId, index) => ({
      id: uid(),
      name: `Align ${constraints.length + index + 1}`,
      type: 'align',
      enabled: true,
      shapeId,
      referenceShapeId,
      axis: constraintAxis,
      anchor: 'center',
      referenceAnchor: 'center',
    }))
    setConstraints((previous) => [...previous, ...nextConstraints])
    setStatus(`Added ${nextConstraints.length} alignment constraint${nextConstraints.length === 1 ? '' : 's'}`)
  }

  const handleApplyConstraints = () => {
    if (constraints.length === 0) {
      setStatus('No constraints to apply')
      return
    }
    setShapes((previous) => applyParametricConstraints(previous, layers, constraints))
    setStatus('Applied parametric constraints')
  }

  const handleAlignSelection = (axis: 'x' | 'y' | 'both') => {
    if (selectedShapeIdSet.size < 2) {
      setStatus('Select at least two shapes to align')
      return
    }
    setShapes((previous) => alignSelectedShapes(previous, selectedShapeIdSet, axis))
    const axisLabel = axis === 'both' ? 'X/Y centers' : axis.toUpperCase()
    setStatus(`Aligned selected shapes on ${axisLabel}`)
  }

  const handleAlignSelectionToGrid = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to align to the grid')
      return
    }
    setShapes((previous) => alignSelectedShapesToGrid(previous, selectedShapeIdSet, snapSettings.gridStep))
    setStatus('Aligned selected shapes to grid')
  }

  const handleApplySeamAllowanceToSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }

    const safeOffset = clamp(seamAllowanceInputMm, 0.1, 150)
    const selectedIds = new Set(selectedShapeIds)

    setSeamAllowances((previous) => {
      const retained = previous.filter((entry) => !selectedIds.has(entry.shapeId))
      const created = selectedShapeIds.map((shapeId) => ({
        id: uid(),
        shapeId,
        offsetMm: safeOffset,
      }))
      return [...retained, ...created]
    })

    setStatus(`Applied ${safeOffset.toFixed(1)}mm seam allowance to ${selectedShapeIds.length} shape${selectedShapeIds.length === 1 ? '' : 's'}`)
  }

  const handleClearSeamAllowanceOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setStatus('Cleared seam allowance on selected shapes')
  }

  const handleClearAllSeamAllowances = () => {
    if (seamAllowances.length === 0) {
      setStatus('No seam allowances to clear')
      return
    }
    setSeamAllowances([])
    setStatus('Cleared all seam allowances')
  }

  const handleToggleConstraintEnabled = (constraintId: string) => {
    setConstraints((previous) =>
      previous.map((entry) =>
        entry.id === constraintId
          ? {
              ...entry,
              enabled: !entry.enabled,
            }
          : entry,
      ),
    )
  }

  const handleDeleteConstraint = (constraintId: string) => {
    setConstraints((previous) => previous.filter((entry) => entry.id !== constraintId))
  }

  const handleDeleteSelectedHardwareMarker = () => {
    if (!selectedHardwareMarker) {
      setStatus('No hardware marker selected')
      return
    }

    const markerId = selectedHardwareMarker.id
    setHardwareMarkers((previous) => previous.filter((marker) => marker.id !== markerId))
    setSelectedHardwareMarkerId(null)
    setStatus('Deleted hardware marker')
  }

  const handleUpdateSelectedHardwareMarker = (patch: Partial<HardwareMarker>) => {
    if (!selectedHardwareMarker) {
      return
    }

    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.id === selectedHardwareMarker.id
          ? {
              ...marker,
              ...patch,
            }
          : marker,
      ),
    )
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

    if (mobileFileAction === 'export-pdf') {
      handleExportPdf()
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

    if (mobileFileAction === 'pattern-tools') {
      setShowPatternToolsModal(true)
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
  const topbarClassName = `topbar ${isMobileLayout ? 'topbar-mobile' : `desktop-ribbon-tab-${desktopRibbonTab}`} ${
    isMobileLayout && !showMobileMenu ? 'topbar-compact' : ''
  }`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)
  const showViewOptions = showMobileMenu && mobileOptionsTab === 'view'
  const showLayerOptions = showMobileMenu && mobileOptionsTab === 'layers'
  const showFileOptions = showMobileMenu && mobileOptionsTab === 'file'
  const showDesktopToolSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopPresetSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopZoomSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopEditSection = desktopRibbonTab === 'edit'
  const showDesktopLineTypeSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopStitchSection = desktopRibbonTab === 'stitch'
  const showDesktopLayerSection =
    desktopRibbonTab === 'build' ||
    desktopRibbonTab === 'edit' ||
    desktopRibbonTab === 'stitch' ||
    desktopRibbonTab === 'layers'
  const showDesktopFileSection = desktopRibbonTab === 'output'
  const showToolSection = isMobileLayout || showDesktopToolSection
  const showPresetSection = isMobileLayout ? showViewOptions : showDesktopPresetSection
  const showZoomSection = isMobileLayout ? showViewOptions : showDesktopZoomSection
  const showEditSection = isMobileLayout ? showViewOptions : showDesktopEditSection
  const showLineTypeSection = isMobileLayout ? showViewOptions : showDesktopLineTypeSection
  const showStitchSection = isMobileLayout ? showViewOptions : showDesktopStitchSection
  const showLayerSection = isMobileLayout ? showLayerOptions : showDesktopLayerSection
  const showFileSection = isMobileLayout ? showFileOptions : showDesktopFileSection
  const showLayerLegend = !(isMobileLayout && mobileViewMode === 'split')

  return (
    <div className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <header className={topbarClassName}>
        {!isMobileLayout && (
          <div className="desktop-ribbon-strip">
            <div className="desktop-ribbon-brand">
              <span className="desktop-ribbon-app">LeatherCAD</span>
              <span className="desktop-ribbon-mode">Desktop Builder</span>
            </div>
            <nav className="desktop-ribbon-tabs" aria-label="Desktop ribbon tabs">
              {DESKTOP_RIBBON_TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={desktopRibbonTab === tab.value ? 'active' : ''}
                  onClick={() => setDesktopRibbonTab(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="desktop-ribbon-strip-meta">
              <span>{selectedShapeCount} selected</span>
              <span>{selectedStitchHoleCount} selected holes</span>
              <span>{showThreePreview ? '3D on' : '3D off'}</span>
              <button
                type="button"
                className="help-button"
                onClick={() => setShowHelpModal(true)}
                aria-label="Open help"
                title="Help"
              >
                ?
              </button>
            </div>
          </div>
        )}

        <div className={`topbar-body ${isMobileLayout ? 'topbar-body-mobile' : 'desktop-ribbon-panel'}`}>
          {showToolSection && (
            <div className="group tool-group ribbon-section" data-section="Geometry">
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
                    <button className={mobileViewMode === 'editor' ? 'active' : ''} onClick={() => setMobileViewMode('editor')}>
                      2D
                    </button>
                    <button
                      className={mobileViewMode === 'preview' ? 'active' : ''}
                      onClick={() => setMobileViewMode('preview')}
                      disabled={!showThreePreview}
                    >
                      3D
                    </button>
                    <button
                      className={mobileViewMode === 'split' ? 'active' : ''}
                      onClick={() => setMobileViewMode('split')}
                      disabled={!showThreePreview}
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
                  <button className={tool === 'hardware' ? 'active' : ''} onClick={() => setActiveTool('hardware')}>
                    Hardware
                  </button>
                </>
              )}
              {isMobileLayout && (
                <>
                  <button
                    type="button"
                    className="help-button mobile-help-toggle"
                    onClick={() => setShowHelpModal(true)}
                    aria-label="Open help"
                    title="Help"
                  >
                    ?
                  </button>
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
                </>
              )}
            </div>
          )}

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

          {showPresetSection && (
            <div className="group preset-controls ribbon-section" data-section="Workspace">
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
          )}

          {showZoomSection && (
            <div className="group zoom-controls ribbon-section" data-section="View">
              <button onClick={() => handleZoomStep(0.85)}>-</button>
              <button onClick={() => handleZoomStep(1.15)}>+</button>
              <button onClick={handleFitView}>Fit</button>
              <button onClick={handleResetView}>Reset</button>
            </div>
          )}

          {showEditSection && (
            <div className="group edit-controls ribbon-section" data-section="Edit">
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
          )}

          {showLineTypeSection && (
            <div className="group line-type-controls ribbon-section" data-section="Line Types">
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
          )}

          {showStitchSection && (
            <div className="ribbon-section ribbon-stitch" data-section="Stitching">
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
            </div>
          )}

          {showLayerSection && (
            <div className="group layer-controls ribbon-section" data-section="Layers">
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
          )}

          {showFileSection && (
            <div className="group file-controls ribbon-section" data-section="Output">
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
                    <option value="export-pdf">Export PDF</option>
                    <option value="export-dxf">Export DXF</option>
                    <option value="export-options">Export Options</option>
                    <option value="template-repository">Template Repository</option>
                    <option value="pattern-tools">Pattern Tools</option>
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
                  <button onClick={handleExportPdf}>Export PDF</button>
                  <button onClick={handleExportDxf}>Export DXF</button>
                  <button onClick={() => setShowExportOptionsModal(true)}>Export Options</button>
                  <button onClick={() => setShowPatternToolsModal(true)}>Pattern Tools</button>
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
          )}
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

              {seamGuides.map((guide) => (
                <g key={guide.id}>
                  <path d={guide.d} className="seam-guide-line" />
                  {showAnnotations && (
                    <text x={guide.labelPoint.x + 5} y={guide.labelPoint.y + 5} className="seam-guide-label">
                      {`${guide.offsetMm.toFixed(1)}mm seam`}
                    </text>
                  )}
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
                      : lineType?.color ??
                        (lineTypeRole === 'cut' ? cutStrokeColor : displayLayerColorsById[shape.layerId] ?? cutStrokeColor)
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

              {visibleHardwareMarkers.map((marker) => {
                const isSelected = marker.id === selectedHardwareMarkerId
                return (
                  <g
                    key={marker.id}
                    className={isSelected ? 'hardware-marker hardware-marker-selected' : 'hardware-marker'}
                    onPointerDown={(event) => handleHardwarePointerDown(event, marker.id)}
                  >
                    <circle cx={marker.point.x} cy={marker.point.y} r={3.2} />
                    <line x1={marker.point.x - 4.2} y1={marker.point.y} x2={marker.point.x + 4.2} y2={marker.point.y} />
                    <line x1={marker.point.x} y1={marker.point.y - 4.2} x2={marker.point.x} y2={marker.point.y + 4.2} />
                    <text x={marker.point.x + 4.8} y={marker.point.y - 4.8} className="hardware-marker-label">
                      {`${marker.label} (${marker.holeDiameterMm.toFixed(1)}mm)`}
                    </text>
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

              {annotationLabels.map((label) => (
                <text key={label.id} x={label.point.x} y={label.point.y} className="annotation-label">
                  {label.text}
                </text>
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
                  <span>{legendMode === 'layer' ? 'Front -> Back' : 'Height'}</span>
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
                        <span className="layer-legend-swatch" style={{ background: entry.swatchBackground }} />
                        <span className="stack-level-chip">{`z${entry.stackLevel}`}</span>
                        <span className="stack-level-label">{entry.layerNames.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="legend-key-list">
                  <div className="legend-key-item">
                    <span className="layer-legend-swatch" style={{ backgroundColor: cutStrokeColor }} />
                    <span>Cut lines</span>
                  </div>
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
              onUpdateFoldLine={(foldLineId, updates) =>
                setFoldLines((previous) =>
                  previous.map((foldLine) =>
                    foldLine.id === foldLineId
                      ? sanitizeFoldLine({
                          ...foldLine,
                          ...updates,
                        })
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

      {showHelpModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowHelpModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowHelpModal(false)
            }
          }}
          role="presentation"
        >
          <div
            className="help-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
          >
            <div className="line-type-modal-header">
              <h2 id="help-modal-title">Help</h2>
              <button onClick={() => setShowHelpModal(false)}>Close</button>
            </div>
            <ul className="help-list">
              <li>Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+C/X/V clipboard, Delete removes selection.</li>
              <li>Mobile: use 2D / 3D / Split buttons to focus workspace.</li>
            </ul>
          </div>
        </div>
      )}

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

            <p className="hint">Applies to SVG, PDF, and DXF exports.</p>

            <div className="control-block">
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={exportOnlySelectedShapes}
                  onChange={(event) => setExportOnlySelectedShapes(event.target.checked)}
                />
                <span>Export only selected shapes</span>
              </label>
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
                  setExportOnlySelectedShapes(false)
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

      {showPatternToolsModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPatternToolsModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowPatternToolsModal(false)
            }
          }}
          role="presentation"
        >
          <div className="line-type-modal pattern-tools-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="line-type-modal-header">
              <h2>Pattern Tools</h2>
              <button onClick={() => setShowPatternToolsModal(false)}>Done</button>
            </div>
            <p className="hint">
              Manage sub-sketches, constraints, seam offsets, snapping, annotations, and hardware markers from one panel.
            </p>

            <div className="control-block">
              <h3>Snap + Align</h3>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={snapSettings.enabled}
                  onChange={(event) =>
                    setSnapSettings((previous) => ({
                      ...previous,
                      enabled: event.target.checked,
                    }))
                  }
                />
                <span>Enable snapping</span>
              </label>
              <div className="pattern-toggle-grid">
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={snapSettings.grid}
                    onChange={(event) =>
                      setSnapSettings((previous) => ({
                        ...previous,
                        grid: event.target.checked,
                      }))
                    }
                  />
                  <span>Grid</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={snapSettings.endpoints}
                    onChange={(event) =>
                      setSnapSettings((previous) => ({
                        ...previous,
                        endpoints: event.target.checked,
                      }))
                    }
                  />
                  <span>Endpoints</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={snapSettings.midpoints}
                    onChange={(event) =>
                      setSnapSettings((previous) => ({
                        ...previous,
                        midpoints: event.target.checked,
                      }))
                    }
                  />
                  <span>Midpoints</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={snapSettings.guides}
                    onChange={(event) =>
                      setSnapSettings((previous) => ({
                        ...previous,
                        guides: event.target.checked,
                      }))
                    }
                  />
                  <span>Guides</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={snapSettings.hardware}
                    onChange={(event) =>
                      setSnapSettings((previous) => ({
                        ...previous,
                        hardware: event.target.checked,
                      }))
                    }
                  />
                  <span>Hardware</span>
                </label>
              </div>
              <label className="field-row">
                <span>Grid snap step (mm)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={snapSettings.gridStep}
                  onChange={(event) =>
                    setSnapSettings((previous) => ({
                      ...previous,
                      gridStep: clamp(Number(event.target.value) || 0.1, 0.1, 1000),
                    }))
                  }
                />
              </label>
              <div className="button-row">
                <button onClick={() => handleAlignSelection('x')} disabled={selectedShapeCount < 2}>
                  Align X
                </button>
                <button onClick={() => handleAlignSelection('y')} disabled={selectedShapeCount < 2}>
                  Align Y
                </button>
                <button onClick={() => handleAlignSelection('both')} disabled={selectedShapeCount < 2}>
                  Align XY
                </button>
                <button onClick={handleAlignSelectionToGrid} disabled={selectedShapeCount === 0}>
                  Align to Grid
                </button>
              </div>
            </div>

            <div className="control-block">
              <h3>Sub-Sketches + Annotations</h3>
              <label className="field-row">
                <span>Active sub-sketch</span>
                <select
                  className="action-select"
                  value={activeSketchGroup?.id ?? ''}
                  onChange={(event) => setActiveSketchGroupId(event.target.value || null)}
                >
                  <option value="">None</option>
                  {sketchGroups
                    .filter((group) => group.layerId === activeLayerId)
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                        {group.visible ? '' : ' (hidden)'}
                        {group.locked ? ' (locked)' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <div className="line-type-modal-actions">
                <button onClick={handleCreateSketchGroupFromSelection} disabled={selectedShapeCount === 0}>
                  Create from Selection
                </button>
                <button onClick={handleDuplicateActiveSketchGroup} disabled={!activeSketchGroup}>
                  Place Copy
                </button>
                <button onClick={handleRenameActiveSketchGroup} disabled={!activeSketchGroup}>
                  Rename
                </button>
                <button onClick={handleToggleActiveSketchGroupVisibility} disabled={!activeSketchGroup}>
                  {activeSketchGroup?.visible ? 'Hide' : 'Show'}
                </button>
                <button onClick={handleToggleActiveSketchGroupLock} disabled={!activeSketchGroup}>
                  {activeSketchGroup?.locked ? 'Unlock' : 'Lock'}
                </button>
                <button onClick={handleClearActiveSketchGroup} disabled={!activeSketchGroup}>
                  Clear Active
                </button>
                <button onClick={handleDeleteActiveSketchGroup} disabled={!activeSketchGroup}>
                  Delete Sub-Sketch
                </button>
              </div>
              <div className="line-type-edit-grid">
                <label className="field-row">
                  <span>Layer annotation</span>
                  <input
                    value={activeLayer?.annotation ?? ''}
                    placeholder="e.g. Main body"
                    onChange={(event) => handleSetActiveLayerAnnotation(event.target.value)}
                  />
                </label>
                <label className="field-row">
                  <span>Sub-sketch annotation</span>
                  <input
                    value={activeSketchGroup?.annotation ?? ''}
                    placeholder="e.g. Inner pocket"
                    onChange={(event) => handleSetActiveSketchAnnotation(event.target.value)}
                    disabled={!activeSketchGroup}
                  />
                </label>
              </div>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={showAnnotations}
                  onChange={(event) => setShowAnnotations(event.target.checked)}
                />
                <span>Show annotation labels on canvas</span>
              </label>
            </div>

            <div className="control-block">
              <h3>Parametric Constraints</h3>
              <div className="line-type-edit-grid">
                <label className="field-row">
                  <span>Edge</span>
                  <select
                    className="action-select"
                    value={constraintEdge}
                    onChange={(event) => setConstraintEdge(event.target.value as ConstraintEdge)}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
                <label className="field-row">
                  <span>Offset (mm)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={constraintOffsetMm}
                    onChange={(event) => setConstraintOffsetMm(clamp(Number(event.target.value) || 0, 0, 999))}
                  />
                </label>
                <label className="field-row">
                  <span>Align axis</span>
                  <select
                    className="action-select"
                    value={constraintAxis}
                    onChange={(event) => setConstraintAxis(event.target.value as ConstraintAxis)}
                  >
                    <option value="x">X</option>
                    <option value="y">Y</option>
                    <option value="both">Both</option>
                  </select>
                </label>
              </div>
              <div className="line-type-modal-actions">
                <button onClick={handleAddEdgeConstraintFromSelection} disabled={selectedShapeCount === 0}>
                  Add Edge Offset
                </button>
                <button onClick={handleAddAlignConstraintsFromSelection} disabled={selectedShapeCount < 2}>
                  Add Align Rules
                </button>
                <button onClick={handleApplyConstraints} disabled={constraints.length === 0}>
                  Apply Constraints
                </button>
              </div>
              {constraints.length === 0 ? (
                <p className="hint">No constraints yet.</p>
              ) : (
                <div className="template-list pattern-constraint-list">
                  {constraints.map((constraint) => (
                    <div key={constraint.id} className="pattern-constraint-item">
                      <label className="layer-toggle-item">
                        <input
                          type="checkbox"
                          checked={constraint.enabled}
                          onChange={() => handleToggleConstraintEnabled(constraint.id)}
                        />
                        <span>{constraint.name}</span>
                      </label>
                      <span className="template-item-meta">
                        {constraint.type === 'edge-offset'
                          ? `${constraint.edge} @ ${constraint.offsetMm.toFixed(1)}mm`
                          : `Align ${constraint.axis}`}
                      </span>
                      <button onClick={() => handleDeleteConstraint(constraint.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="control-block">
              <h3>Seam Offsets</h3>
              <label className="field-row">
                <span>Offset distance (mm)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={seamAllowanceInputMm}
                  onChange={(event) => setSeamAllowanceInputMm(clamp(Number(event.target.value) || 0.1, 0.1, 150))}
                />
              </label>
              <div className="line-type-modal-actions">
                <button onClick={handleApplySeamAllowanceToSelection} disabled={selectedShapeCount === 0}>
                  Apply to Selection
                </button>
                <button onClick={handleClearSeamAllowanceOnSelection} disabled={selectedShapeCount === 0}>
                  Clear on Selection
                </button>
                <button onClick={handleClearAllSeamAllowances} disabled={seamAllowances.length === 0}>
                  Clear All
                </button>
              </div>
            </div>

            <div className="control-block">
              <h3>Hardware Markers</h3>
              <div className="line-type-edit-grid">
                <label className="field-row">
                  <span>Preset</span>
                  <select
                    className="action-select"
                    value={hardwarePreset}
                    onChange={(event) => setHardwarePreset(event.target.value as HardwareKind)}
                  >
                    <option value="snap">Snap</option>
                    <option value="rivet">Rivet</option>
                    <option value="buckle">Buckle</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="field-row">
                  <span>Custom hole (mm)</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={customHardwareDiameterMm}
                    disabled={hardwarePreset !== 'custom'}
                    onChange={(event) => setCustomHardwareDiameterMm(clamp(Number(event.target.value) || 0.1, 0.1, 120))}
                  />
                </label>
                <label className="field-row">
                  <span>Custom spacing (mm)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={customHardwareSpacingMm}
                    disabled={hardwarePreset !== 'custom'}
                    onChange={(event) => setCustomHardwareSpacingMm(clamp(Number(event.target.value) || 0, 0, 300))}
                  />
                </label>
              </div>
              <div className="line-type-modal-actions">
                <button onClick={() => setActiveTool('hardware')}>Use Hardware Tool</button>
                <button onClick={() => setActiveTool('pan')}>Back to Move Tool</button>
              </div>
              <p className="hint">
                Pick the Hardware tool, then click on canvas to place markers with metadata for holes and spacing.
              </p>

              {selectedHardwareMarker ? (
                <div className="line-type-edit-grid">
                  <label className="field-row">
                    <span>Label</span>
                    <input
                      value={selectedHardwareMarker.label}
                      onChange={(event) => handleUpdateSelectedHardwareMarker({ label: event.target.value })}
                    />
                  </label>
                  <label className="field-row">
                    <span>Hole diameter (mm)</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={selectedHardwareMarker.holeDiameterMm}
                      onChange={(event) =>
                        handleUpdateSelectedHardwareMarker({
                          holeDiameterMm: clamp(Number(event.target.value) || 0.1, 0.1, 120),
                        })
                      }
                    />
                  </label>
                  <label className="field-row">
                    <span>Spacing (mm)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={selectedHardwareMarker.spacingMm}
                      onChange={(event) =>
                        handleUpdateSelectedHardwareMarker({
                          spacingMm: clamp(Number(event.target.value) || 0, 0, 300),
                        })
                      }
                    />
                  </label>
                  <label className="field-row">
                    <span>Notes</span>
                    <input
                      value={selectedHardwareMarker.notes ?? ''}
                      placeholder="e.g. set with #9 snap"
                      onChange={(event) => handleUpdateSelectedHardwareMarker({ notes: event.target.value })}
                    />
                  </label>
                  <label className="layer-toggle-item">
                    <input
                      type="checkbox"
                      checked={selectedHardwareMarker.visible}
                      onChange={(event) => handleUpdateSelectedHardwareMarker({ visible: event.target.checked })}
                    />
                    <span>Visible</span>
                  </label>
                  <div className="line-type-modal-actions">
                    <button onClick={handleDeleteSelectedHardwareMarker}>Delete Marker</button>
                  </div>
                </div>
              ) : (
                <p className="hint">Select a hardware marker in Move tool to edit metadata.</p>
              )}
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
        <span className="statusbar-meta">{Math.round(viewport.scale * 100)}% zoom</span>
        <span className="statusbar-meta">
          {visibleShapes.length}/{shapes.length} visible shapes
        </span>
        <span className="statusbar-meta">{layers.length} layers</span>
        <span className="statusbar-meta">{sketchGroups.length} sub-sketches</span>
        <span className="statusbar-meta">
          {lineTypes.filter((lineType) => lineType.visible).length}/{lineTypes.length} line types
        </span>
        <span className="statusbar-meta">{foldLines.length} bends</span>
        <span className="statusbar-meta">{stitchHoles.length} stitch holes</span>
        <span className="statusbar-meta">{seamAllowances.length} seam offsets</span>
        <span className="statusbar-meta">{constraints.length} constraints</span>
        <span className="statusbar-meta">{hardwareMarkers.length} hardware markers</span>
        <span className="statusbar-meta">{tracingOverlays.length} traces</span>
        <span className="statusbar-meta">{templateRepository.length} templates</span>
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

export default EditorApp
