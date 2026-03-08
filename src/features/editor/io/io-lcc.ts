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
  DocFile,
  Layer,
  LineShape,
  LineType,
  LineTypeRole,
  LineTypeStyle,
  Point,
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

type LccFile = {
  meta?: LccMeta
  layers?: LccLayer[]
  shapes?: LccShape[]
  backdrops?: unknown[]
  printareas?: unknown[]
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

  // Build shapes and stitch holes
  const shapes: Shape[] = []
  const stitchHoles: StitchHole[] = []
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
          // Still import dimension lines but mark with guide role – they're useful reference
        }

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
    showDimensions: lccLayers.some((l) => l.id === 4), // show dimensions if dimension layer existed
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
