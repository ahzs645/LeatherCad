/**
 * LCC file format importer for LeathercraftCAD v2.x files (.lcc)
 *
 * LCC is a JSON format (often with UTF-8 BOM) produced by the macOS app
 * "LeathercraftCAD". The format stores layers by numeric id, shapes with
 * named colors/dashes, stitch holes with linked chains, ellipses, text,
 * and dimension annotations.
 *
 * This importer converts LCC data into our internal DocFile representation.
 */

import { uid } from '../cad/cad-geometry'
import type {
  ArcShape,
  BezierShape,
  DimensionLine,
  DocFile,
  Layer,
  LineShape,
  LineType,
  LineTypeRole,
  LineTypeStyle,
  Point,
  PrintArea,
  Shape,
  StitchHole,
  TextShape,
} from '../cad/cad-types'
import { createDefaultLineTypes } from '../cad/line-types'

// ---------------------------------------------------------------------------
// LCC raw types
// ---------------------------------------------------------------------------

type LccMeta = {
  file_type?: string
  version?: string
}

type LccLayer = {
  id: number
  chk?: string
  nam?: string
  indp?: string
}

type LccShape = {
  id: string
  type: string
  sp: [number, number]
  ep: [number, number]
  ct: [number, number]
  w: string
  h: string
  color: string
  dash: string
  opc?: string
  path?: string
  rt: string
  st: string
  inv: string
  bz1: [number, number]
  bz2: [number, number]
  thk: string
  la: string
  lb: string
  iv: string
  ih: string
  sta: string
  swa: string
  tx: string
  fs: string
  ff: string
  txst: string
  txrd: string
  guid?: string
  nm: string
  gid: string
  dim: string
  arst: string
  ared: string
  layer: string
  plidx: string
  // Stitch hole specific
  pr?: { bt?: string; p?: string }
  StcIn?: [number, number]
  StcOut?: [number, number]
  PrevStId?: string
  NextStId?: string
}

type LccBackdrop = {
  src?: string
  x?: number
  y?: number
  w?: number
  h?: number
  opc?: string
  lock?: string
}

type LccPrintArea = {
  offset?: [number, number]
  target?: boolean
  scalepos?: number
}

type LccFile = {
  meta?: LccMeta
  layers?: LccLayer[]
  shapes?: LccShape[]
  backdrops?: LccBackdrop[]
  printareas?: LccPrintArea[]
}

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------

const LCC_COLOR_MAP: Record<string, string> = {
  aqua: '#00ffff',
  black: '#000000',
  blue: '#0000ff',
  brown: '#8b4513',
  cyan: '#00ffff',
  darkgray: '#a9a9a9',
  fuchsia: '#ff00ff',
  gray: '#808080',
  green: '#008000',
  lightgray: '#d3d3d3',
  lime: '#00ff00',
  magenta: '#ff00ff',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  orange: '#ff8c00',
  pink: '#ffc0cb',
  purple: '#800080',
  red: '#ff0000',
  silver: '#c0c0c0',
  teal: '#008080',
  violet: '#ee82ee',
  white: '#ffffff',
  yellow: '#ffff00',
}

function resolveLccColor(name: string): string {
  return LCC_COLOR_MAP[name.toLowerCase()] ?? '#ffffff'
}

// ---------------------------------------------------------------------------
// Dash mapping
// ---------------------------------------------------------------------------

function resolveLccDash(dash: string): LineTypeStyle {
  const lower = dash.toLowerCase()
  if (lower === 'dash') return 'dashed'
  if (lower === 'dot') return 'dotted'
  if (lower === 'dashdot' || lower === 'dashdotdot') return 'dash-dot-dot'
  return 'solid'
}

// ---------------------------------------------------------------------------
// Layer-to-role heuristic
// ---------------------------------------------------------------------------

const LAYER_ROLE_MAP: Record<number, LineTypeRole> = {
  0: 'cut',
  1: 'fold',
  2: 'mark',
  3: 'stitch',
  4: 'guide', // dimensions layer → guide
}

function layerRole(layerIndex: number): LineTypeRole {
  return LAYER_ROLE_MAP[layerIndex] ?? 'cut'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pt(coords: [number, number]): Point {
  return { x: coords[0], y: coords[1] }
}

function parseLccFloat(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

// ---------------------------------------------------------------------------
// Ellipse → arc shapes
// ---------------------------------------------------------------------------

function ellipseToArcShapes(
  center: Point,
  w: number,
  h: number,
  layerId: string,
  lineTypeId: string,
): ArcShape[] {
  // Approximate a full ellipse as 4 three-point arcs (quadrants)
  const rx = w / 2
  const ry = h / 2
  const cx = center.x
  const cy = center.y

  // Cardinal points
  const right: Point = { x: cx + rx, y: cy }
  const top: Point = { x: cx, y: cy - ry }
  const left: Point = { x: cx - rx, y: cy }
  const bottom: Point = { x: cx, y: cy + ry }

  // Mid-arc points (at 45 degree increments on the ellipse)
  const cos45 = Math.SQRT1_2
  const midRT: Point = { x: cx + rx * cos45, y: cy - ry * cos45 }
  const midTL: Point = { x: cx - rx * cos45, y: cy - ry * cos45 }
  const midLB: Point = { x: cx - rx * cos45, y: cy + ry * cos45 }
  const midBR: Point = { x: cx + rx * cos45, y: cy + ry * cos45 }

  return [
    { id: uid(), type: 'arc', layerId, lineTypeId, start: right, mid: midRT, end: top },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: top, mid: midTL, end: left },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: left, mid: midLB, end: bottom },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: bottom, mid: midBR, end: right },
  ]
}

function ellipseArcToShapes(
  center: Point,
  w: number,
  h: number,
  startAngleDeg: number,
  sweepAngleDeg: number,
  layerId: string,
  lineTypeId: string,
): ArcShape[] {
  const rx = w / 2
  const ry = h / 2
  const cx = center.x
  const cy = center.y
  const toRad = Math.PI / 180

  const startRad = startAngleDeg * toRad
  const endRad = (startAngleDeg + sweepAngleDeg) * toRad
  const midRad = (startRad + endRad) / 2

  const pointAt = (rad: number): Point => ({
    x: cx + rx * Math.cos(rad),
    y: cy + ry * Math.sin(rad),
  })

  return [
    {
      id: uid(),
      type: 'arc',
      layerId,
      lineTypeId,
      start: pointAt(startRad),
      mid: pointAt(midRad),
      end: pointAt(endRad),
    },
  ]
}

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------

export type LccImportResult = {
  doc: DocFile
  warnings: string[]
  summary: {
    shapeCount: number
    stitchHoleCount: number
    layerCount: number
    skippedDimensionShapes: number
    ellipseCount: number
    textCount: number
  }
}

export function importLccDocument(raw: string): LccImportResult {
  // Strip UTF-8 BOM if present
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const data: LccFile = JSON.parse(cleaned)
  const warnings: string[] = []

  // Validate meta
  if (data.meta?.file_type !== 'LeathercraftCAD') {
    warnings.push(`Unexpected file_type: ${data.meta?.file_type ?? 'missing'}`)
  }

  // Build layers
  const lccLayers = Array.isArray(data.layers) ? data.layers : []
  const layerIdMap = new Map<string, string>() // LCC numeric layer id → our uuid
  const layers: Layer[] = []

  for (const lccLayer of lccLayers) {
    const layerUid = uid()
    layerIdMap.set(String(lccLayer.id), layerUid)
    layers.push({
      id: layerUid,
      name: lccLayer.nam ?? `Layer ${lccLayer.id}`,
      visible: lccLayer.chk !== '0',
      locked: false,
      stackLevel: lccLayer.id,
    })
  }

  // Ensure at least one layer
  if (layers.length === 0) {
    const fallbackId = uid()
    layerIdMap.set('0', fallbackId)
    layers.push({ id: fallbackId, name: 'Layer 1', visible: true, locked: false, stackLevel: 0 })
  }

  const activeLayerId = layers[0].id

  // Build line types – create one per unique (layer, color, dash) combination found
  const lineTypes = createDefaultLineTypes()
  const lineTypeMap = new Map<string, string>() // "layer:color:dash" → lineType.id
  const lccShapes = Array.isArray(data.shapes) ? data.shapes : []

  // Pre-scan to build line type mapping
  for (const shape of lccShapes) {
    const key = `${shape.layer}:${shape.color}:${shape.dash}`
    if (lineTypeMap.has(key)) continue

    const role = layerRole(parseInt(shape.layer, 10))
    const style = resolveLccDash(shape.dash)
    const color = resolveLccColor(shape.color)

    // Try to find an existing line type that matches
    const existing = lineTypes.find(
      (lt) => lt.role === role && lt.style === style && lt.color === color,
    )
    if (existing) {
      lineTypeMap.set(key, existing.id)
      continue
    }

    // Create a new line type
    const newLt: LineType = {
      id: uid(),
      name: `${shape.color} ${shape.dash} (Layer ${shape.layer})`,
      role,
      style,
      color,
      visible: true,
    }
    lineTypes.push(newLt)
    lineTypeMap.set(key, newLt.id)
  }

  const activeLineTypeId = lineTypes[0]?.id ?? 'type-cut'

  // Build shapes, stitch holes, and dimension lines
  const shapes: Shape[] = []
  const stitchHoles: StitchHole[] = []
  const dimensionLines: DimensionLine[] = []
  let skippedDimensionShapes = 0
  let ellipseCount = 0
  let textCount = 0

  // Map from LCC shape id → stitch hole info for chain building
  const stitchHoleIdMap = new Map<string, string>() // LCC shape id → our stitch hole id
  const stitchNextMap = new Map<string, string>() // LCC shape id → LCC next shape id

  for (const lccShape of lccShapes) {
    const lccLayerId = lccShape.layer ?? '0'
    const layerId = layerIdMap.get(lccLayerId) ?? activeLayerId
    const ltKey = `${lccLayerId}:${lccShape.color}:${lccShape.dash}`
    const lineTypeId = lineTypeMap.get(ltKey) ?? activeLineTypeId

    switch (lccShape.type) {
      case 'LINE': {
        const isDimension = lccShape.dim === '-1'
        if (isDimension) {
          skippedDimensionShapes++

          // Dimension lines with arrows become DimensionLine entities only –
          // they should NOT be added as regular visible shapes.
          const hasArrowStart = lccShape.arst === '-1'
          const hasArrowEnd = lccShape.ared === '-1'
          if (hasArrowStart || hasArrowEnd) {
            dimensionLines.push({
              id: uid(),
              start: pt(lccShape.sp),
              end: pt(lccShape.ep),
              offsetMm: 5,
              layerId,
              lineTypeId,
            })
          }
          break
        }

        const hasArrowStart = lccShape.arst === '-1'
        const hasArrowEnd = lccShape.ared === '-1'

        // Check for bezier control points – when bz1/bz2 are non-zero,
        // the LCC LINE is actually a cubic bezier. We approximate as a
        // quadratic bezier using the average of the two control points.
        const bz1 = lccShape.bz1
        const bz2 = lccShape.bz2
        const hasBezier =
          (bz1[0] !== 0 || bz1[1] !== 0) || (bz2[0] !== 0 || bz2[1] !== 0)

        if (hasBezier) {
          const bezier: BezierShape = {
            id: uid(),
            type: 'bezier',
            layerId,
            lineTypeId,
            arrowStart: hasArrowStart || undefined,
            arrowEnd: hasArrowEnd || undefined,
            start: pt(lccShape.sp),
            control: {
              x: (bz1[0] + bz2[0]) / 2,
              y: (bz1[1] + bz2[1]) / 2,
            },
            end: pt(lccShape.ep),
          }
          shapes.push(bezier)
        } else {
          const line: LineShape = {
            id: uid(),
            type: 'line',
            layerId,
            lineTypeId,
            arrowStart: hasArrowStart || undefined,
            arrowEnd: hasArrowEnd || undefined,
            start: pt(lccShape.sp),
            end: pt(lccShape.ep),
          }
          shapes.push(line)
        }
        break
      }

      case 'ELLIPSE': {
        ellipseCount++
        const w = parseLccFloat(lccShape.w)
        const h = parseLccFloat(lccShape.h)
        const center = pt(lccShape.ct)
        const startAngle = parseLccFloat(lccShape.sta)
        const sweepAngle = parseLccFloat(lccShape.swa)

        if (w <= 0 || h <= 0) {
          warnings.push(`Ellipse ${lccShape.id} has zero size, skipped`)
          break
        }

        if (sweepAngle !== 0) {
          // Partial arc/ellipse – create a single three-point arc
          const arcs = ellipseArcToShapes(center, w, h, startAngle, sweepAngle, layerId, lineTypeId)
          shapes.push(...arcs)
        } else {
          // Full ellipse – 4 quadrant arcs
          const arcs = ellipseToArcShapes(center, w, h, layerId, lineTypeId)
          shapes.push(...arcs)
        }
        break
      }

      case 'S_HOLE': {
        // Create a small circle shape to represent the hole visually
        const center = pt(lccShape.sp)
        const holeDiam = parseLccFloat(lccShape.w)
        const radius = holeDiam / 2

        // Create a line shape that the stitch hole references
        const markerLine: LineShape = {
          id: uid(),
          type: 'line',
          layerId,
          lineTypeId,
          start: { x: center.x - radius, y: center.y },
          end: { x: center.x + radius, y: center.y },
        }
        shapes.push(markerLine)

        const holeId = uid()
        const angleDeg = parseLccFloat(lccShape.rt)
        const isRound = lccShape.st === 'R' || lccShape.st === ''

        stitchHoles.push({
          id: holeId,
          shapeId: markerLine.id,
          point: center,
          angleDeg,
          holeType: isRound ? 'round' : 'slit',
          sequence: 0, // will be recomputed from chain
        })

        stitchHoleIdMap.set(lccShape.id, holeId)
        if (lccShape.NextStId && lccShape.NextStId !== '-1') {
          stitchNextMap.set(lccShape.id, lccShape.NextStId)
        }
        break
      }

      case 'TEXT': {
        textCount++
        const text = lccShape.tx
        if (!text || text.trim().length === 0) {
          skippedDimensionShapes++
          break
        }

        // Skip dimension label text (e.g. "28mm") – these are
        // auto-generated by the dimension line renderer.
        if (lccShape.dim === '-1') {
          skippedDimensionShapes++
          break
        }

        const textShape: TextShape = {
          id: uid(),
          type: 'text',
          layerId,
          lineTypeId,
          start: pt(lccShape.sp),
          end: pt(lccShape.ep),
          text,
          fontFamily: lccShape.ff || 'sans-serif',
          fontSizeMm: parseLccFloat(lccShape.fs) || 10,
          transform: 'none',
          radiusMm: 0,
          sweepDeg: 0,
        }
        shapes.push(textShape)
        break
      }

      default: {
        warnings.push(`Unknown shape type "${lccShape.type}" (id: ${lccShape.id}), skipped`)
        break
      }
    }
  }

  // Rebuild stitch hole sequences from the linked list chains
  rebuildStitchSequences(stitchHoles, stitchHoleIdMap, stitchNextMap)

  // Convert LCC print areas
  const printAreas: PrintArea[] = []
  const lccPrintAreas = Array.isArray(data.printareas) ? data.printareas : []
  for (const lccPa of lccPrintAreas) {
    if (!lccPa || typeof lccPa !== 'object') continue
    const pa = lccPa as LccPrintArea
    const offset = Array.isArray(pa.offset) ? pa.offset : [0, 0]
    // LCC scalepos: 0 = 100%, higher values are different scales
    const scalePercent = pa.scalepos === 0 ? 100 : pa.scalepos === 1 ? 50 : 100
    printAreas.push({
      id: uid(),
      offsetX: offset[0] ?? 0,
      offsetY: offset[1] ?? 0,
      widthMm: 210, // A4 default – LCC doesn't store paper size in print area
      heightMm: 297,
      scalePercent,
    })
  }

  // Convert LCC backdrops to tracing overlay placeholders
  // Note: LCC backdrops reference local file paths which we can't load,
  // but we preserve the metadata so users know what was referenced
  const lccBackdrops = Array.isArray(data.backdrops) ? data.backdrops : []
  if (lccBackdrops.length > 0) {
    warnings.push(`${lccBackdrops.length} backdrop image(s) referenced but cannot be loaded (local file paths)`)
  }

  const doc: DocFile = {
    version: 1,
    units: 'mm',
    layers,
    activeLayerId,
    lineTypes,
    activeLineTypeId,
    objects: shapes,
    foldLines: [],
    stitchHoles,
    dimensionLines: dimensionLines.length > 0 ? dimensionLines : undefined,
    printAreas: printAreas.length > 0 ? printAreas : undefined,
    showDimensions: false,
  }

  return {
    doc,
    warnings,
    summary: {
      shapeCount: shapes.length,
      stitchHoleCount: stitchHoles.length,
      layerCount: layers.length,
      skippedDimensionShapes,
      ellipseCount,
      textCount,
    },
  }
}

// ---------------------------------------------------------------------------
// Stitch hole sequence rebuilding
// ---------------------------------------------------------------------------

function rebuildStitchSequences(
  stitchHoles: StitchHole[],
  idMap: Map<string, string>, // lcc id → our stitch hole id
  nextMap: Map<string, string>, // lcc id → lcc next id
) {
  if (stitchHoles.length === 0) return

  const holeById = new Map(stitchHoles.map((h) => [h.id, h]))
  const reverseIdMap = new Map<string, string>() // our id → lcc id
  for (const [lccId, ourId] of idMap) {
    reverseIdMap.set(ourId, lccId)
  }

  // Find chain starts: holes that are not referenced as "next" by any other hole
  const referencedAsNext = new Set(nextMap.values())
  const lccIds = [...idMap.keys()]
  const chainStarts = lccIds.filter((lccId) => !referencedAsNext.has(lccId))

  // If no clear start, just use all holes
  if (chainStarts.length === 0) {
    stitchHoles.forEach((h, i) => {
      h.sequence = i
    })
    return
  }

  let globalSeq = 0
  const visited = new Set<string>()

  for (const startLccId of chainStarts) {
    let current: string | undefined = startLccId
    while (current && !visited.has(current)) {
      visited.add(current)
      const ourId = idMap.get(current)
      if (ourId) {
        const hole = holeById.get(ourId)
        if (hole) {
          hole.sequence = globalSeq++
        }
      }
      current = nextMap.get(current)
    }
  }

  // Assign remaining unvisited holes
  for (const lccId of lccIds) {
    if (visited.has(lccId)) continue
    const ourId = idMap.get(lccId)
    if (ourId) {
      const hole = holeById.get(ourId)
      if (hole) {
        hole.sequence = globalSeq++
      }
    }
  }
}

// ---------------------------------------------------------------------------
// LCC Export
// ---------------------------------------------------------------------------

const REVERSE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(LCC_COLOR_MAP).map(([name, hex]) => [hex.toLowerCase(), name.charAt(0).toUpperCase() + name.slice(1)]),
)

function hexToLccColor(hex: string): string {
  return REVERSE_COLOR_MAP[hex.toLowerCase()] ?? 'White'
}

function styleToLccDash(style: LineTypeStyle): string {
  if (style === 'dashed') return 'Dash'
  if (style === 'dotted') return 'Dot'
  if (style === 'dash-dot-dot') return 'DashDotDot'
  return 'Solid'
}

let exportIdCounter = 1000

function nextExportId(): string {
  return String(exportIdCounter++)
}

function emptyLccShape(): Omit<LccShape, 'id' | 'type' | 'sp' | 'ep' | 'ct' | 'color' | 'dash' | 'layer'> {
  return {
    w: '0.0',
    h: '0.0',
    opc: '0.5',
    path: '',
    rt: '0.0',
    st: '',
    inv: '0',
    bz1: [0, 0],
    bz2: [0, 0],
    thk: '1.5',
    la: '0.0',
    lb: '0.0',
    iv: '-1',
    ih: '0',
    sta: '0.0',
    swa: '0.0',
    tx: '',
    fs: '10.0',
    ff: 'sans-serif',
    txst: '1.0',
    txrd: '0.0',
    guid: `{${uid()}}`,
    nm: '',
    gid: '0',
    dim: '0',
    arst: '0',
    ared: '0',
    plidx: '0',
  }
}

export function exportLccDocument(doc: DocFile): string {
  exportIdCounter = 1000

  const lineTypesById = Object.fromEntries(doc.lineTypes.map((lt) => [lt.id, lt]))

  // Build layer mapping: our layerId → LCC layer index
  const layerIndexMap = new Map<string, number>()
  const lccLayers: LccLayer[] = doc.layers.map((layer, index) => {
    layerIndexMap.set(layer.id, index)
    return {
      id: index,
      chk: layer.visible ? '-1' : '0',
      nam: layer.name,
      indp: '0',
    }
  })

  const lccShapes: LccShape[] = []

  for (const shape of doc.objects) {
    const lineType = lineTypesById[shape.lineTypeId]
    const color = lineType ? hexToLccColor(lineType.color) : 'White'
    const dash = lineType ? styleToLccDash(lineType.style) : 'Solid'
    const lccLayerIdx = layerIndexMap.get(shape.layerId) ?? 0
    const layer = String(lccLayerIdx)
    const arrowStart = ('arrowStart' in shape && shape.arrowStart) ? '-1' : '0'
    const arrowEnd = ('arrowEnd' in shape && shape.arrowEnd) ? '-1' : '0'

    if (shape.type === 'line') {
      lccShapes.push({
        ...emptyLccShape(),
        id: nextExportId(),
        type: 'LINE',
        sp: [shape.start.x, shape.start.y],
        ep: [shape.end.x, shape.end.y],
        ct: [(shape.start.x + shape.end.x) / 2, (shape.start.y + shape.end.y) / 2],
        color,
        dash,
        arst: arrowStart,
        ared: arrowEnd,
        layer,
      })
    } else if (shape.type === 'arc') {
      // Export arc as ELLIPSE with center and bounding box
      const cx = (shape.start.x + shape.end.x) / 2
      const cy = (shape.start.y + shape.end.y) / 2
      const w = Math.abs(shape.end.x - shape.start.x)
      const h = Math.abs(shape.end.y - shape.start.y)
      lccShapes.push({
        ...emptyLccShape(),
        id: nextExportId(),
        type: 'LINE',
        sp: [shape.start.x, shape.start.y],
        ep: [shape.end.x, shape.end.y],
        ct: [cx, cy],
        w: String(w),
        h: String(h),
        color,
        dash,
        arst: arrowStart,
        ared: arrowEnd,
        layer,
      })
    } else if (shape.type === 'bezier') {
      lccShapes.push({
        ...emptyLccShape(),
        id: nextExportId(),
        type: 'LINE',
        sp: [shape.start.x, shape.start.y],
        ep: [shape.end.x, shape.end.y],
        ct: [shape.control.x, shape.control.y],
        bz1: [shape.control.x, shape.control.y],
        bz2: [shape.control.x, shape.control.y],
        color,
        dash,
        arst: arrowStart,
        ared: arrowEnd,
        layer,
      })
    } else if (shape.type === 'text') {
      lccShapes.push({
        ...emptyLccShape(),
        id: nextExportId(),
        type: 'TEXT',
        sp: [shape.start.x, shape.start.y],
        ep: [shape.end.x, shape.end.y],
        ct: [(shape.start.x + shape.end.x) / 2, (shape.start.y + shape.end.y) / 2],
        tx: shape.text,
        ff: shape.fontFamily,
        fs: String(shape.fontSizeMm),
        color,
        dash,
        layer,
      })
    }
  }

  // Export stitch holes
  if (doc.stitchHoles) {
    const sortedHoles = [...doc.stitchHoles].sort((a, b) => a.sequence - b.sequence)
    for (let i = 0; i < sortedHoles.length; i++) {
      const hole = sortedHoles[i]
      const lineType = lineTypesById[doc.activeLineTypeId]
      const color = lineType ? hexToLccColor(lineType.color) : 'White'
      const stitchId = nextExportId()
      const prevId = i > 0 ? String(parseInt(stitchId) - 1) : '-1'
      const nextId = i < sortedHoles.length - 1 ? String(parseInt(stitchId) + 1) : '-1'
      const lccLayerIdx = 3 // stitch layer

      lccShapes.push({
        ...emptyLccShape(),
        id: stitchId,
        type: 'S_HOLE',
        sp: [hole.point.x, hole.point.y],
        ep: [0, 0],
        ct: [hole.point.x, hole.point.y],
        w: '1.2',
        h: '1.2',
        color,
        dash: 'Solid',
        rt: String(hole.angleDeg),
        st: hole.holeType === 'round' ? 'R' : 'S',
        thk: '1.0',
        PrevStId: prevId,
        NextStId: nextId,
        StcIn: [hole.point.x - 0.45, hole.point.y],
        StcOut: [hole.point.x + 0.45, hole.point.y],
        layer: String(lccLayerIdx),
      })
    }
  }

  // Build print areas
  const lccPrintAreas: LccPrintArea[] = (doc.printAreas ?? []).map((pa) => ({
    offset: [pa.offsetX, pa.offsetY] as [number, number],
    target: true,
    scalepos: pa.scalePercent === 100 ? 0 : 1,
  }))

  const lccFile: LccFile = {
    meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
    layers: lccLayers,
    shapes: lccShapes,
    backdrops: [],
    printareas: lccPrintAreas.length > 0 ? lccPrintAreas : [{ offset: [0, 0], target: true, scalepos: 0 }],
  }

  return '\uFEFF' + JSON.stringify(lccFile, null, 2)
}
