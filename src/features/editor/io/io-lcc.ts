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
  Backdrop,
  BezierShape,
  DocFile,
  FoldLine,
  Layer,
  LineShape,
  LineType,
  PrintArea,
  Shape,
  StitchHole,
  TextShape,
} from '../cad/cad-types'
import { createDefaultLineTypes } from '../cad/line-types'
import type { LccFile, LccLayer, LccPrintArea, LccShape, RawDimensionSegment, RawDimensionText } from './lcc/lcc-types'
import {
  hexToLccColor,
  layerRole,
  parseLccFloat,
  pt,
  resolveLccColor,
  resolveLccDash,
  styleToLccDash,
} from './lcc/lcc-color-style'
import { parseLccPathCenter, rebuildImportedDimensions } from './lcc/lcc-dimensions'
import { ellipseArcToShapes, ellipseToArcShapes } from './lcc/lcc-ellipse'
import { rebuildStitchSequences } from './lcc/lcc-stitch'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'

// ---------------------------------------------------------------------------
// LCC raw types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------

export type LccImportResult = {
  doc: DocFile
  warnings: string[]
  summary: {
    shapeCount: number
    stitchHoleCount: number
    foldCount: number
    layerCount: number
    skippedDimensionShapes: number
    ellipseCount: number
    textCount: number
  }
}

export function importLccDocument(raw: string): LccImportResult {
  // Strip UTF-8 BOM if present
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const data = JSON.parse(cleaned) as LccFile
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

  // Build editable shapes and stitch holes; source dimension primitives are
  // collected separately and reconstructed as logical dimension overlays.
  const shapes: Shape[] = []
  const foldLines: FoldLine[] = []
  const stitchHoles: StitchHole[] = []
  const rawDimensionSegments: RawDimensionSegment[] = []
  const rawDimensionTexts: RawDimensionText[] = []
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
          rawDimensionSegments.push({
            sourceId: lccShape.id,
            sourceGroupId: lccShape.gid,
            start: pt(lccShape.sp),
            end: pt(lccShape.ep),
            hasArrowStart: lccShape.arst === '-1',
            hasArrowEnd: lccShape.ared === '-1',
            layerId,
            lineTypeId,
          })
          break
        }

        const hasArrowStart = lccShape.arst === '-1'
        const hasArrowEnd = lccShape.ared === '-1'
        const start = pt(lccShape.sp)
        const end = pt(lccShape.ep)

        // Check for bezier control points – when bz1/bz2 are non-zero,
        // the LCC LINE is actually a cubic bezier. We approximate as a
        // quadratic bezier using the average of the two control points.
        const bz1 = lccShape.bz1
        const bz2 = lccShape.bz2
        const hasBezier =
          (bz1[0] !== 0 || bz1[1] !== 0) || (bz2[0] !== 0 || bz2[1] !== 0)

        if (!hasBezier && layerRole(parseInt(lccLayerId, 10)) === 'fold') {
          foldLines.push({
            id: uid(),
            name: lccShape.nm?.trim() || `Crease ${foldLines.length + 1}`,
            start,
            end,
            angleDeg: 90,
            maxAngleDeg: 180,
            direction: DEFAULT_FOLD_DIRECTION,
            radiusMm: DEFAULT_FOLD_RADIUS_MM,
            thicknessMm: parseLccFloat(lccShape.thk) || DEFAULT_FOLD_THICKNESS_MM,
            neutralAxisRatio: DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
            stiffness: DEFAULT_FOLD_STIFFNESS,
            clearanceMm: DEFAULT_FOLD_CLEARANCE_MM,
          })
        }

        if (hasBezier) {
          const bezier: BezierShape = {
            id: uid(),
            type: 'bezier',
            layerId,
            lineTypeId,
            arrowStart: hasArrowStart || undefined,
            arrowEnd: hasArrowEnd || undefined,
            start,
            control: {
              x: (bz1[0] + bz2[0]) / 2,
              y: (bz1[1] + bz2[1]) / 2,
            },
            end,
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
            start,
            end,
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
          diameterMm: holeDiam > 0 ? holeDiam : undefined,
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

        // Dimension label text (e.g. "28mm") is reconstructed as part of the
        // logical dimension overlay instead of being imported as editable text.
        if (lccShape.dim === '-1') {
          const visualCenter = parseLccPathCenter(lccShape.path)
          const anchor = visualCenter ?? pt(lccShape.sp)
          skippedDimensionShapes++
          rawDimensionTexts.push({
            sourceId: lccShape.id,
            sourceGroupId: lccShape.gid,
            text,
            anchor,
            center: anchor,
            layerId,
            fontSizeMm: parseLccFloat(lccShape.fs) || undefined,
            rotationDeg: parseLccFloat(lccShape.rt) || undefined,
            placement: visualCenter ? 'center' : 'baseline',
          })
          break
        }

        // LCC stores text rotation in the `rt` field (degrees, clockwise in
        // the source's Y-down coordinate system). Its `ep` field is not a
        // second baseline endpoint — it's a text-metrics offset that, if
        // used naively, produces a mirrored / upside-down baseline. Build
        // the baseline from `sp` + `rt` instead, with an approximate length
        // derived from font size and character count, so each label reads
        // the way it was authored.
        const lccFontSizeMm = parseLccFloat(lccShape.fs) || 10
        const isDimLabel = lccShape.dim === '-1'
        // Dim labels: source files author these at a size that ends up a
        // touch heavy next to thin extension lines. Shrink slightly and
        // nudge the anchor off the arrow line so the label reads as "above"
        // the dimension rather than sitting on it.
        const fontSizeMm = isDimLabel ? lccFontSizeMm * 0.75 : lccFontSizeMm
        const rotationDeg = parseLccFloat(lccShape.rt) || 0
        const baselineLenMm = Math.max(fontSizeMm * text.length * 0.6, fontSizeMm)
        // LCC Y-down + clockwise rotation maps to our coord system as-is:
        // rt=0 → baseline points +x (right), rt=90 → +y (down),
        // rt=180 → -x (left), rt=270 → -y (up).
        const angleRad = (rotationDeg * Math.PI) / 180
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)
        // Perpendicular to the baseline, pointing "above" the text in
        // reading orientation (screen-up for horizontal text).
        const liftMm = isDimLabel ? fontSizeMm * 0.6 : 0
        const spPoint = pt(lccShape.sp)
        const anchor = {
          x: spPoint.x + sin * liftMm,
          y: spPoint.y - cos * liftMm,
        }
        const textShape: TextShape = {
          id: uid(),
          type: 'text',
          layerId,
          lineTypeId,
          start: anchor,
          end: {
            x: anchor.x + cos * baselineLenMm,
            y: anchor.y + sin * baselineLenMm,
          },
          text,
          fontFamily: lccShape.ff || 'sans-serif',
          fontSizeMm,
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
  const dimensionLines = rebuildImportedDimensions(rawDimensionSegments, rawDimensionTexts)

  // Convert LCC print areas
  const printAreas: PrintArea[] = []
  const lccPrintAreas = Array.isArray(data.printareas) ? data.printareas : []
  for (const lccPa of lccPrintAreas) {
    if (!lccPa || typeof lccPa !== 'object') continue
    const pa = lccPa
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

  // Convert LCC backdrops. The source-app `.lcc` format stores either:
  //   - a local file path in `src` (can't be resolved from the browser), or
  //   - an inline base64 data URL (recognizable by the `data:` prefix).
  // Embedded bitmaps round-trip; path-only references become placeholders the
  // user can redirect by re-importing the file.
  const lccBackdrops = Array.isArray(data.backdrops) ? data.backdrops : []
  const nextBackdrops: Backdrop[] = []
  let backdropPathOnlyCount = 0
  for (const entry of lccBackdrops) {
    const src = typeof entry.src === 'string' ? entry.src : ''
    const width = typeof entry.w === 'number' && entry.w > 0 ? entry.w : 100
    const height = typeof entry.h === 'number' && entry.h > 0 ? entry.h : 100
    const x = typeof entry.x === 'number' ? entry.x : 0
    const y = typeof entry.y === 'number' ? entry.y : 0
    const opcRaw = typeof entry.opc === 'string' ? Number(entry.opc) : 1
    const opacity = Number.isFinite(opcRaw) && opcRaw > 0 ? Math.min(1, Math.max(0.05, opcRaw)) : 1
    const locked = typeof entry.lock === 'string' ? entry.lock === 'true' || entry.lock === '1' : false
    if (src.startsWith('data:')) {
      nextBackdrops.push({
        id: uid(),
        name: 'Backdrop',
        bitmapDataUrl: src,
        bitmapWidth: Math.round(width),
        bitmapHeight: Math.round(height),
        leftTop: { x, y },
        width,
        height,
        angleDeg: 0,
        visible: true,
        locked,
        opacity,
      })
    } else if (src.length > 0) {
      backdropPathOnlyCount += 1
    }
  }
  if (backdropPathOnlyCount > 0) {
    warnings.push(
      `${backdropPathOnlyCount} backdrop image(s) referenced by local path and cannot be loaded — re-import them to embed`,
    )
  }

  const doc: DocFile = {
    version: 1,
    units: 'mm',
    layers,
    activeLayerId,
    lineTypes,
    activeLineTypeId,
    objects: shapes,
    foldLines,
    stitchHoles,
    backdrops: nextBackdrops.length > 0 ? nextBackdrops : undefined,
    dimensionLines: dimensionLines.length > 0 ? dimensionLines : undefined,
    printAreas: printAreas.length > 0 ? printAreas : undefined,
    showDimensions: dimensionLines.length > 0,
  }

  return {
    doc,
    warnings,
    summary: {
      shapeCount: shapes.length,
      stitchHoleCount: stitchHoles.length,
      foldCount: foldLines.length,
      layerCount: layers.length,
      skippedDimensionShapes,
      ellipseCount,
      textCount,
    },
  }
}

// ---------------------------------------------------------------------------
// LCC Export
// ---------------------------------------------------------------------------

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

  const exportedBackdrops = (doc.backdrops ?? []).map((backdrop) => ({
    src: backdrop.bitmapDataUrl,
    x: backdrop.leftTop.x,
    y: backdrop.leftTop.y,
    w: backdrop.width,
    h: backdrop.height,
    opc: String(backdrop.opacity),
    lock: backdrop.locked ? 'true' : 'false',
  }))

  const lccFile: LccFile = {
    meta: { file_type: 'LeathercraftCAD', version: '2.8.3' },
    layers: lccLayers,
    shapes: lccShapes,
    backdrops: exportedBackdrops,
    printareas: lccPrintAreas.length > 0 ? lccPrintAreas : [{ offset: [0, 0], target: true, scalepos: 0 }],
  }

  return '\uFEFF' + JSON.stringify(lccFile, null, 2)
}
