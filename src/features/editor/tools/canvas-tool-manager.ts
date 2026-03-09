import { clamp, distance, uid } from '../cad/cad-geometry'
import type {
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  PatternPiece,
  PieceNotch,
  Point,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  StitchHoleType,
  TextTransformMode,
  Tool,
} from '../cad/cad-types'
import { createStitchHole, findNearestStitchAnchor } from '../ops/stitch-hole-ops'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { sanitizeFoldLine } from '../editor-parsers'
import { HARDWARE_PRESETS } from '../editor-constants'
import { fitFreehandCurve, smoothPoints } from '../ops/freehand-ops'
import { findNearestPatternPieceEdge, resolvePatternPieceChains } from '../ops/pattern-piece-ops'

type HardwareKind = HardwareMarker['kind']

export type CommandParseResult =
  | { ok: true; point: Point }
  | { ok: false; message: string }

export type ToolRuntime = {
  draftPoints: Point[]
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  viewportScale: number
  stitchHoleType: StitchHoleType
  hardwarePreset: HardwareKind
  customHardwareDiameterMm: number
  customHardwareSpacingMm: number
  textDraftValue: string
  textFontFamily: string
  textFontSizeMm: number
  textTransformMode: TextTransformMode
  textRadiusMm: number
  textSweepDeg: number
  stitchTargetShapes: Shape[]
  patternPieces: PatternPiece[]
  lineTypesById: Record<string, LineType>
  shapesById: Record<string, Shape>
  layers: Layer[]
  stitchHoles: StitchHole[]
  pieceNotches: PieceNotch[]
  seamConnections: SeamConnection[]
  setDraftPoints: (updater: Point[] | ((previous: Point[]) => Point[])) => void
  clearDraft: () => void
  setStatus: (status: string) => void
  setShapes: (updater: Shape[] | ((previous: Shape[]) => Shape[])) => void
  setFoldLines: (updater: FoldLine[] | ((previous: FoldLine[]) => FoldLine[])) => void
  setStitchHoles: (updater: StitchHole[] | ((previous: StitchHole[]) => StitchHole[])) => void
  setSelectedStitchHoleId: (value: string | null) => void
  setPieceNotches: (updater: PieceNotch[] | ((previous: PieceNotch[]) => PieceNotch[])) => void
  setSeamConnections: (updater: SeamConnection[] | ((previous: SeamConnection[]) => SeamConnection[])) => void
  setHardwareMarkers: (updater: HardwareMarker[] | ((previous: HardwareMarker[]) => HardwareMarker[])) => void
  setSelectedHardwareMarkerId: (value: string | null) => void
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
  toolManager: CanvasToolManager
  pointPicked: (point: Point) => void
}

export type ToolCommandContext = {
  tool: Tool
  runtime: ToolRuntime
  referencePoint: Point
}

export interface CanvasToolHandler {
  pointerDown: (point: Point, runtime: ToolRuntime) => void
  processCommand?: (command: string, context: ToolCommandContext) => string
}

const MIN_SHAPE_DISTANCE = 0.001

function withWritableShapeTarget(runtime: ToolRuntime) {
  if (!runtime.ensureActiveLayerWritable() || !runtime.ensureActiveLineTypeWritable()) {
    return false
  }
  return true
}

function addLineShape(
  runtime: ToolRuntime,
  start: Point,
  end: Point,
  overrides?: Partial<Pick<Shape, 'layerId' | 'lineTypeId' | 'groupId'>>,
) {
  runtime.setShapes((previous) => [
    ...previous,
    {
      id: uid(),
      type: 'line',
      layerId: overrides?.layerId ?? runtime.activeLayerId,
      lineTypeId: overrides?.lineTypeId ?? runtime.activeLineTypeId,
      groupId: overrides?.groupId ?? runtime.activeSketchGroup?.id,
      start,
      end,
    },
  ])
}

function ellipsePolylinePoints(center: Point, radiusX: number, radiusY: number) {
  const safeRadiusX = Math.max(0, Math.abs(radiusX))
  const safeRadiusY = Math.max(0, Math.abs(radiusY))
  if (safeRadiusX < MIN_SHAPE_DISTANCE || safeRadiusY < MIN_SHAPE_DISTANCE) {
    return [] as Point[]
  }

  const circumference = 2 * Math.PI * Math.sqrt((safeRadiusX * safeRadiusX + safeRadiusY * safeRadiusY) / 2)
  const segments = Math.max(24, Math.min(180, Math.round(circumference / 6)))
  const points: Point[] = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    points.push({
      x: center.x + Math.cos(angle) * safeRadiusX,
      y: center.y + Math.sin(angle) * safeRadiusY,
    })
  }
  return points
}

function createPolylineAsLines(runtime: ToolRuntime, points: Point[]) {
  if (points.length < 2) {
    return 0
  }

  runtime.setShapes((previous) => {
    const created: Shape[] = []
    for (let index = 1; index < points.length; index += 1) {
      created.push({
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: points[index - 1],
        end: points[index],
      })
    }

    if (points.length > 2) {
      created.push({
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: points[points.length - 1],
        end: points[0],
      })
    }

    return [...previous, ...created]
  })

  return points.length
}

const lineTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Line: pick end point')
      return
    }

    const start = runtime.draftPoints[0]
    if (distance(start, point) < MIN_SHAPE_DISTANCE) {
      runtime.setStatus('Line ignored: start and end overlap')
      runtime.clearDraft()
      return
    }

    addLineShape(runtime, start, point)
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Line created')
  },
}

const polylineTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Polyline: pick next point, press Escape to finish')
      return
    }

    const start = runtime.draftPoints[runtime.draftPoints.length - 1]
    if (distance(start, point) < MIN_SHAPE_DISTANCE) {
      runtime.setStatus('Polyline segment ignored: points overlap')
      return
    }

    addLineShape(runtime, start, point)
    runtime.setDraftPoints([point])
    runtime.pointPicked(point)
    runtime.setStatus('Polyline segment created')
  },
}

const rectangleTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Rectangle: pick opposite corner')
      return
    }

    const start = runtime.draftPoints[0]
    if (distance(start, point) < MIN_SHAPE_DISTANCE) {
      runtime.setStatus('Rectangle ignored: corners overlap')
      runtime.clearDraft()
      return
    }

    const p1 = { x: start.x, y: start.y }
    const p2 = { x: point.x, y: start.y }
    const p3 = { x: point.x, y: point.y }
    const p4 = { x: start.x, y: point.y }

    runtime.setShapes((previous) => [
      ...previous,
      {
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: p1,
        end: p2,
      },
      {
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: p2,
        end: p3,
      },
      {
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: p3,
        end: p4,
      },
      {
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: p4,
        end: p1,
      },
    ])
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Rectangle created')
  },
}

const circleTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Circle: pick radius point')
      return
    }

    const center = runtime.draftPoints[0]
    const radius = distance(center, point)
    const points = ellipsePolylinePoints(center, radius, radius)
    if (points.length < 2) {
      runtime.setStatus('Circle ignored: radius too small')
      runtime.clearDraft()
      return
    }

    createPolylineAsLines(runtime, points)
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Circle created')
  },
}

const ellipseTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Ellipse: pick radius extents')
      return
    }

    const center = runtime.draftPoints[0]
    const radiusX = point.x - center.x
    const radiusY = point.y - center.y
    const points = ellipsePolylinePoints(center, radiusX, radiusY)
    if (points.length < 2) {
      runtime.setStatus('Ellipse ignored: radius too small')
      runtime.clearDraft()
      return
    }

    createPolylineAsLines(runtime, points)
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Ellipse created')
  },
}

const arcTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length < 2) {
      runtime.setDraftPoints((previous) => [...previous, point])
      runtime.pointPicked(point)
      runtime.setStatus(runtime.draftPoints.length === 0 ? 'Arc: pick midpoint' : 'Arc: pick end point')
      return
    }

    runtime.setShapes((previous) => [
      ...previous,
      {
        id: uid(),
        type: 'arc',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: runtime.draftPoints[0],
        mid: runtime.draftPoints[1],
        end: point,
      },
    ])
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Arc created')
  },
}

const bezierTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length < 2) {
      runtime.setDraftPoints((previous) => [...previous, point])
      runtime.pointPicked(point)
      runtime.setStatus(runtime.draftPoints.length === 0 ? 'Bezier: pick control point' : 'Bezier: pick end point')
      return
    }

    runtime.setShapes((previous) => [
      ...previous,
      {
        id: uid(),
        type: 'bezier',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: runtime.draftPoints[0],
        control: runtime.draftPoints[1],
        end: point,
      },
    ])
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Bezier created')
  },
}

const foldTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Fold line: pick end point')
      return
    }

    const start = runtime.draftPoints[0]
    if (distance(start, point) < MIN_SHAPE_DISTANCE) {
      runtime.setStatus('Fold line ignored: start and end overlap')
      runtime.clearDraft()
      return
    }

    runtime.setFoldLines((previous) => [
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
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus('Fold line assigned')
  },
}

const stitchHoleTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    const nearestStitchAnchor = findNearestStitchAnchor(
      point,
      runtime.stitchTargetShapes,
      runtime.lineTypesById,
      16 / Math.max(0.1, runtime.viewportScale),
    )
    if (!nearestStitchAnchor) {
      runtime.setStatus('No stitch path near pointer. Tap near a visible stitch line.')
      return
    }

    const targetShape = runtime.shapesById[nearestStitchAnchor.shapeId]
    if (!targetShape) {
      runtime.setStatus('Could not resolve stitch path')
      return
    }

    const targetLayer = runtime.layers.find((layer) => layer.id === targetShape.layerId)
    if (targetLayer?.locked) {
      runtime.setStatus('Target layer is locked. Unlock it before placing stitch holes.')
      return
    }

    let createdHoleId: string | null = null
    runtime.setStitchHoles((previous) => {
      const nextSequence =
        previous
          .filter((stitchHole) => stitchHole.shapeId === nearestStitchAnchor.shapeId)
          .reduce((maximum, stitchHole) => Math.max(maximum, stitchHole.sequence), -1) + 1
      const createdHole = {
        ...createStitchHole(nearestStitchAnchor, runtime.stitchHoleType),
        sequence: nextSequence,
      }
      createdHoleId = createdHole.id
      return [...previous, createdHole]
    })
    runtime.setSelectedStitchHoleId(createdHoleId)
    runtime.pointPicked(point)
    runtime.setStatus(`Stitch hole placed (${runtime.stitchHoleType})`)
  },
}

const textTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    const safeText = runtime.textDraftValue.trim().length > 0 ? runtime.textDraftValue.trim() : 'Text'
    const safeFontSize = clamp(runtime.textFontSizeMm || 12, 2, 120)
    const baseLength = Math.max(safeFontSize * 0.8, safeText.length * safeFontSize * 0.62)
    runtime.setShapes((previous) => [
      ...previous,
      {
        id: uid(),
        type: 'text',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: point,
        end: { x: point.x + baseLength, y: point.y },
        text: safeText,
        fontFamily: runtime.textFontFamily,
        fontSizeMm: safeFontSize,
        transform: runtime.textTransformMode,
        radiusMm: clamp(runtime.textRadiusMm || 40, 2, 2000),
        sweepDeg: clamp(runtime.textSweepDeg || 140, -1080, 1080),
      },
    ])
    runtime.pointPicked(point)
    runtime.clearDraft()
    runtime.setStatus(`Text placed: ${safeText}`)
  },
}

const hardwareTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!runtime.ensureActiveLayerWritable()) {
      return
    }

    const preset = runtime.hardwarePreset === 'custom' ? null : HARDWARE_PRESETS[runtime.hardwarePreset]
    const marker: HardwareMarker = {
      id: uid(),
      layerId: runtime.activeLayerId,
      groupId: runtime.activeSketchGroup?.id,
      point,
      kind: runtime.hardwarePreset,
      label: runtime.hardwarePreset === 'custom' ? 'Hardware' : preset?.label ?? 'Hardware',
      holeDiameterMm:
        runtime.hardwarePreset === 'custom'
          ? clamp(runtime.customHardwareDiameterMm || 4, 0.1, 120)
          : (preset?.holeDiameterMm ?? 4),
      spacingMm:
        runtime.hardwarePreset === 'custom'
          ? clamp(runtime.customHardwareSpacingMm || 0, 0, 300)
          : (preset?.spacingMm ?? 0),
      notes: '',
      visible: true,
    }
    runtime.setHardwareMarkers((previous) => [...previous, marker])
    runtime.setSelectedHardwareMarkerId(marker.id)
    runtime.pointPicked(point)
    runtime.setStatus(`Placed hardware marker (${marker.kind})`)
  },
}

const pieceNotchTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!runtime.ensureActiveLayerWritable()) {
      return
    }

    const pieceChains = resolvePatternPieceChains(runtime.stitchTargetShapes, Object.values(runtime.lineTypesById))
    const nearest = findNearestPatternPieceEdge(point, runtime.patternPieces, pieceChains.byShapeId)
    if (!nearest) {
      runtime.setStatus('Piece notch: click a pattern piece boundary')
      return
    }

    const nextNotch: PieceNotch = {
      id: uid(),
      pieceId: nearest.piece.id,
      edgeIndex: nearest.edgeIndex,
      t: nearest.t,
      style: 'single',
      lengthMm: 4,
      widthMm: 2,
      angleMode: 'normal',
      showOnSeam: true,
    }
    runtime.setPieceNotches((previous) => [...previous, nextNotch])
    runtime.pointPicked(point)
    runtime.setStatus(`Added notch to ${nearest.piece.name}`)
  },
}

type PendingSeamSelection = {
  pieceId: string
  pieceName: string
  edgeIndex: number
}

const seamTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!runtime.ensureActiveLayerWritable()) {
      return
    }

    const pieceChains = resolvePatternPieceChains(runtime.stitchTargetShapes, Object.values(runtime.lineTypesById))
    const nearest = findNearestPatternPieceEdge(point, runtime.patternPieces, pieceChains.byShapeId)
    if (!nearest) {
      runtime.setStatus('Seam: click a pattern piece edge')
      return
    }

    const manager = runtime.toolManager
    const pending = manager.getPendingSeamSelection()
    const selectedEdge = {
      pieceId: nearest.piece.id,
      pieceName: nearest.piece.name,
      edgeIndex: nearest.edgeIndex,
    }

    if (!pending) {
      manager.setPendingSeamSelection(selectedEdge)
      runtime.pointPicked(point)
      runtime.setStatus(`Seam start set: ${nearest.piece.name} edge ${nearest.edgeIndex + 1}. Click the matching edge.`)
      return
    }

    if (pending.pieceId === selectedEdge.pieceId && pending.edgeIndex === selectedEdge.edgeIndex) {
      manager.clearPendingSeamSelection()
      runtime.setStatus('Seam selection cleared')
      return
    }

    const duplicate = runtime.seamConnections.some(
      (connection) =>
        (connection.from.pieceId === pending.pieceId &&
          connection.from.edgeIndex === pending.edgeIndex &&
          connection.to.pieceId === selectedEdge.pieceId &&
          connection.to.edgeIndex === selectedEdge.edgeIndex) ||
        (connection.to.pieceId === pending.pieceId &&
          connection.to.edgeIndex === pending.edgeIndex &&
          connection.from.pieceId === selectedEdge.pieceId &&
          connection.from.edgeIndex === selectedEdge.edgeIndex),
    )

    if (duplicate) {
      manager.clearPendingSeamSelection()
      runtime.setStatus('A seam connection already exists between those edges')
      return
    }

    const connection: SeamConnection = {
      id: uid(),
      from: {
        pieceId: pending.pieceId,
        edgeIndex: pending.edgeIndex,
      },
      to: {
        pieceId: selectedEdge.pieceId,
        edgeIndex: selectedEdge.edgeIndex,
      },
      kind: 'sewn',
      reversed: false,
    }
    runtime.setSeamConnections((previous) => [...previous, connection])
    manager.clearPendingSeamSelection()
    runtime.pointPicked(point)
    runtime.setStatus(
      `Created seam: ${pending.pieceName} edge ${pending.edgeIndex + 1} to ${selectedEdge.pieceName} edge ${selectedEdge.edgeIndex + 1}`,
    )
  },
}

const freehandTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    if (runtime.draftPoints.length === 0) {
      // Start collecting points
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Freehand: drawing... press Escape to finish')
      return
    }

    // Add point to freehand stroke
    const lastPoint = runtime.draftPoints[runtime.draftPoints.length - 1]
    if (distance(lastPoint, point) < 0.5) {
      return // Skip near-duplicate
    }

    runtime.setDraftPoints((prev) => [...prev, point])
  },
  processCommand(command: string, context: ToolCommandContext): string {
    const trimmed = command.trim().toLowerCase()
    if (trimmed === 'finish' || trimmed === 'done') {
      const { runtime } = context
      const rawPoints = runtime.draftPoints

      if (rawPoints.length < 3) {
        runtime.clearDraft()
        runtime.setStatus('Freehand: not enough points')
        return 'Not enough points for freehand curve'
      }

      // Smooth and fit
      const smoothed = smoothPoints(rawPoints, 3)
      const shapes = fitFreehandCurve(
        smoothed,
        1.0, // tolerance in mm
        runtime.activeLayerId,
        runtime.activeLineTypeId,
        runtime.activeSketchGroup?.id,
      )

      if (shapes.length > 0) {
        runtime.setShapes((prev) => [...prev, ...shapes])
        runtime.setStatus(`Freehand: created ${shapes.length} curve segment(s)`)
      } else {
        runtime.setStatus('Freehand: could not fit curve')
      }

      runtime.clearDraft()
      return `Created ${shapes.length} freehand segments`
    }

    return 'Type "finish" to complete freehand drawing'
  },
}

const cutLineTool: CanvasToolHandler = {
  pointerDown(point, runtime) {
    if (!withWritableShapeTarget(runtime)) {
      return
    }

    // Find the 'cut' line type to auto-assign
    const cutLineType = Object.values(runtime.lineTypesById).find((lt) => lt?.role === 'cut')
    const cutLineTypeId = cutLineType?.id ?? runtime.activeLineTypeId

    if (runtime.draftPoints.length === 0) {
      runtime.setDraftPoints([point])
      runtime.pointPicked(point)
      runtime.setStatus('Cut: click to continue, Escape to finish')
      return
    }

    const start = runtime.draftPoints[runtime.draftPoints.length - 1]
    if (distance(start, point) < MIN_SHAPE_DISTANCE) {
      runtime.setStatus('Cut segment ignored: points overlap')
      return
    }

    addLineShape(runtime, start, point, { lineTypeId: cutLineTypeId })
    runtime.setDraftPoints([point])
    runtime.pointPicked(point)
    runtime.setStatus('Cut segment created')
  },
}

const TOOL_HANDLERS: Record<Exclude<Tool, 'pan'>, CanvasToolHandler> = {
  line: lineTool,
  polyline: polylineTool,
  rectangle: rectangleTool,
  circle: circleTool,
  ellipse: ellipseTool,
  arc: arcTool,
  bezier: bezierTool,
  fold: foldTool,
  'stitch-hole': stitchHoleTool,
  hardware: hardwareTool,
  seam: seamTool,
  'piece-notch': pieceNotchTool,
  text: textTool,
  freehand: freehandTool,
  'cut-line': cutLineTool,
}

const VECTOR_PATTERN = /^(@)?(.+)(,|<)(.+)$/

function parseNumber(text: string) {
  if (!text.trim()) {
    return Number.NaN
  }
  const parsed = Number(text.trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseVector(referencePoint: Point, command: string): CommandParseResult {
  const normalized = command.replace(/\s+/g, '')
  const match = normalized.match(VECTOR_PATTERN)
  if (!match) {
    return { ok: false, message: 'Wrong input. Use x,y | @x,y | r<deg | @r<deg' }
  }

  const relative = match[1] !== undefined
  const xRaw = parseNumber(match[2])
  const yRaw = parseNumber(match[4])
  if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) {
    return { ok: false, message: 'Wrong input. Numeric values are required.' }
  }

  const isPolar = match[3] === '<'
  let x = xRaw
  let y = yRaw
  if (isPolar) {
    const angle = (yRaw / 180) * Math.PI
    x = xRaw * Math.cos(angle)
    y = xRaw * Math.sin(angle)
  }

  if (relative) {
    x += referencePoint.x
    y += referencePoint.y
  }

  return {
    ok: true,
    point: { x, y },
  }
}

function processCircleCommand(command: string, context: ToolCommandContext): string {
  const { runtime, referencePoint } = context
  if (runtime.draftPoints.length === 1) {
    const radius = parseNumber(command)
    if (Number.isFinite(radius) && radius > 0) {
      const center = runtime.draftPoints[0]
      circleTool.pointerDown({ x: center.x + radius, y: center.y }, runtime)
      return 'Circle radius applied'
    }
  }
  const vector = parseVector(referencePoint, command)
  if (!vector.ok) {
    return vector.message
  }
  circleTool.pointerDown(vector.point, runtime)
  return 'Point accepted'
}

function processEllipseCommand(command: string, context: ToolCommandContext): string {
  const { runtime, referencePoint } = context
  if (runtime.draftPoints.length === 1) {
    const compact = command.replace(/\s+/g, '')
    const parts = compact.split(',')
    if (parts.length === 2) {
      const rx = parseNumber(parts[0])
      const ry = parseNumber(parts[1])
      if (Number.isFinite(rx) && Number.isFinite(ry) && rx !== 0 && ry !== 0) {
        const center = runtime.draftPoints[0]
        ellipseTool.pointerDown({ x: center.x + rx, y: center.y + ry }, runtime)
        return 'Ellipse radii applied'
      }
    }
  }
  const vector = parseVector(referencePoint, command)
  if (!vector.ok) {
    return vector.message
  }
  ellipseTool.pointerDown(vector.point, runtime)
  return 'Point accepted'
}

export class CanvasToolManager {
  private pendingSeamSelection: PendingSeamSelection | null = null

  getPendingSeamSelection() {
    return this.pendingSeamSelection
  }

  setPendingSeamSelection(selection: PendingSeamSelection) {
    this.pendingSeamSelection = selection
  }

  clearPendingSeamSelection() {
    this.pendingSeamSelection = null
  }

  resetTransientState(nextTool?: Tool) {
    if (nextTool !== 'seam') {
      this.pendingSeamSelection = null
    }
  }

  pointerDown(tool: Tool, point: Point, runtime: ToolRuntime) {
    if (tool === 'pan') {
      return
    }
    TOOL_HANDLERS[tool].pointerDown(point, runtime)
  }

  processCommand(command: string, context: ToolCommandContext): string {
    const trimmed = command.trim()
    if (!trimmed) {
      return 'Command is empty'
    }

    if (trimmed.toLowerCase() === 'help') {
      return 'Use x,y | @x,y | r<deg | @r<deg. For ellipse, you can also use rx,ry after center.'
    }

    if (trimmed.toLowerCase() === 'finish') {
      context.runtime.clearDraft()
      return 'Draft finished'
    }

    if (context.tool === 'pan') {
      return 'Select a drawing tool first'
    }

    if (context.tool === 'circle') {
      return processCircleCommand(trimmed, context)
    }
    if (context.tool === 'ellipse') {
      return processEllipseCommand(trimmed, context)
    }

    const parsed = parseVector(context.referencePoint, trimmed)
    if (!parsed.ok) {
      return parsed.message
    }

    this.pointerDown(context.tool, parsed.point, context.runtime)
    return 'Point accepted'
  }
}

export function getCanvasToolHint(tool: Tool, draftPoints: Point[]) {
  if (tool === 'polyline' && draftPoints.length > 0) {
    return 'Polyline: click to continue, Escape or "finish" to stop'
  }
  if (tool === 'rectangle' && draftPoints.length > 0) {
    return 'Rectangle: pick opposite corner'
  }
  if (tool === 'circle' && draftPoints.length > 0) {
    return 'Circle: pick radius point (or type radius)'
  }
  if (tool === 'ellipse' && draftPoints.length > 0) {
    return 'Ellipse: pick radii point (or type rx,ry)'
  }
  if (tool === 'arc' && draftPoints.length === 1) {
    return 'Arc: pick midpoint'
  }
  if (tool === 'arc' && draftPoints.length === 2) {
    return 'Arc: pick end point'
  }
  if (tool === 'bezier' && draftPoints.length === 1) {
    return 'Bezier: pick control point'
  }
  if (tool === 'bezier' && draftPoints.length === 2) {
    return 'Bezier: pick end point'
  }
  if (tool === 'freehand' && draftPoints.length > 0) {
    return 'Freehand: click to add points, "finish" or Escape to complete'
  }
  if (tool === 'cut-line' && draftPoints.length > 0) {
    return 'Cut: click to continue, Escape to finish'
  }
  if (tool === 'piece-notch') {
    return 'Piece Notch: click a pattern piece edge'
  }
  if (tool === 'seam') {
    return 'Seam: click one piece edge, then the matching edge to create a seam'
  }
  return null
}
