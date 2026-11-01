import type { DocFile, Point, Shape } from '../../cad/cad-types'
import { quadraticToCubicPoints as cubicPoints, type LcadRecord } from './lcad-geometry'
import { exportLcadStitchParameters } from './lcad-stitches'
import { parseCommunityProvenance } from '../../ops/community-provenance'
import { nativeCurveToEditable } from '../../cad/native-curve-ops'

function exportArc(shape: Extract<Shape, { type: 'arc' }>): LcadRecord {
  const { start: a, mid: b, end: c } = shape
  const determinant = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(determinant) < 1e-10) return { type: 'bezier', points: cubicPoints(a, b, c), closed: false }
  const aa = a.x * a.x + a.y * a.y, bb = b.x * b.x + b.y * b.y, cc = c.x * c.x + c.y * c.y
  const cx = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / determinant
  const cy = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / determinant
  const angle = (point: Point) => Math.atan2(point.y - cy, point.x - cx)
  const normalize = (value: number) => ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const startAngle = angle(a), endAngle = angle(c)
  return { type: 'arc', cx, cy, r: Math.hypot(a.x - cx, a.y - cy), startAngle, endAngle, ccw: normalize(angle(b) - startAngle) > normalize(endAngle - startAngle) }
}

export function exportLcadDocument(doc: DocFile): { text: string; warnings: string[] } {
  const warnings: string[] = []
  const communityProvenance = parseCommunityProvenance(doc.communityProvenance)
  const lineTypes = new Map(doc.lineTypes.map(type => [type.id, type]))
  const style = (shape: { id: string; layerId: string; lineTypeId: string; groupId?: string; arrowStart?: boolean; arrowEnd?: boolean; strokeWidthOverride?: number; locked?: boolean; opacity?: number }) => {
    const type = lineTypes.get(shape.lineTypeId)
    return { id: shape.id, layerId: shape.layerId, groupId: shape.groupId, locked: shape.locked ?? false, paletteId: shape.lineTypeId, strokeColor: type?.color ?? '#1a1a1a', strokeWidth: shape.strokeWidthOverride ?? type?.strokeWidthMm ?? 1, strokeDash: type?.style ?? 'solid', fillColor: 'none', alpha: shape.opacity ?? 1, arrowStart: shape.arrowStart, arrowEnd: shape.arrowEnd }
  }
  const shapes: LcadRecord[] = []
  for (const shape of doc.objects) {
    if (shape.type === 'line' && shape.stitchHoleMarker) continue
    const base = style(shape)
    if (shape.type === 'line') shapes.push({ ...base, type: 'line', x1: shape.start.x, y1: shape.start.y, x2: shape.end.x, y2: shape.end.y })
    else if (shape.type === 'arc') shapes.push({ ...base, ...exportArc(shape) })
    else if (shape.type === 'bezier') shapes.push({ ...base, type: 'bezier', points: cubicPoints(shape.start, shape.control, shape.end), closed: false })
    else if (shape.type === 'cubic') shapes.push({ ...base, type: 'bezier', points: [shape.start, shape.control1, shape.control2, shape.end], closed: false })
    else if (shape.type === 'ellipse') {
      if (Math.abs(shape.sweepDeg) >= 360 - 1e-8) shapes.push({ ...base, type: 'ellipse', cx: shape.center.x, cy: shape.center.y, rx: shape.radiusX, ry: shape.radiusY, rotation: shape.rotationDeg * Math.PI / 180 })
      else {
        const segments = nativeCurveToEditable(shape, 0.01)
        for (const segment of segments) shapes.push({ ...style(segment), type: 'line', x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y })
        warnings.push('Partial ellipses are exported as editable line segments within 0.01 mm; use Document JSON to retain analytic parameters')
      }
    }
    else {
      shapes.push({ ...base, type: 'text', x: shape.start.x, y: shape.start.y, content: shape.text, fontFamily: shape.fontFamily, fontSize: shape.fontSizeMm, rotation: Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x), letterSpacing: shape.trackingMm ?? 0, lineSpacing: 1 })
      if (shape.transform !== 'none') warnings.push(`Curved text “${shape.text.slice(0, 30)}” is exported as plain text`)
    }
  }
  for (const hole of doc.stitchHoles ?? []) {
    const parent = doc.objects.find(shape => shape.id === hole.shapeId)
    const base = style({ id: hole.id, layerId: parent?.layerId ?? doc.activeLayerId, lineTypeId: parent?.lineTypeId ?? doc.activeLineTypeId })
    shapes.push({ ...base, type: 'stitch_hole', ...exportLcadStitchParameters(hole), cx: hole.point.x, cy: hole.point.y, runId: hole.chainId ?? hole.shapeId, seq: hole.sequence, endHole: hole.endHole === true })
  }
  for (const dimension of doc.dimensionLines ?? []) shapes.push({ ...style(dimension), type: 'dimension', kind: 'linear', x1: dimension.start.x, y1: dimension.start.y, x2: dimension.end.x, y2: dimension.end.y, offsetDist: dimension.offsetMm, textOverride: dimension.text })
  for (const backdrop of doc.backdrops ?? []) shapes.push({ id: backdrop.id, type: 'tracing_image', layerId: doc.activeLayerId, locked: backdrop.locked, imageData: backdrop.bitmapDataUrl, sourceFile: backdrop.name, x: backdrop.leftTop.x, y: backdrop.leftTop.y, width: backdrop.width, height: backdrop.height, rotation: (backdrop.angleDeg * Math.PI) / 180, alpha: backdrop.opacity, dpi: backdrop.dpi ?? 300, srcWidthPx: backdrop.bitmapWidth, srcHeightPx: backdrop.bitmapHeight })
  if (doc.foldLines.length > 0) {
    for (const fold of doc.foldLines) shapes.push({ id: fold.id, type: 'centerline', layerId: doc.activeLayerId, x1: fold.start.x, y1: fold.start.y, x2: fold.end.x, y2: fold.end.y, strokeColor: '#cc4444', strokeWidth: 0.35, strokeDash: 'center' })
    warnings.push('Fold lines are exported as guides; 3D fold settings are not part of .lcad interchange')
  }
  const unsupported: Array<[string, unknown[] | undefined]> = [['constraints', doc.constraints], ['pattern pieces', doc.patternPieces], ['seam connections', doc.seamConnections], ['assembly connections', doc.assemblyConnections], ['seam allowances', doc.seamAllowances], ['hardware markers', doc.hardwareMarkers], ['tracing overlays', doc.tracingOverlays], ['leather image fills', doc.leatherImageFills]]
  for (const [label, values] of unsupported) if (values?.length) warnings.push(`${label} are not exported in .lcad; use Document JSON for a complete LeatherCad backup`)
  if (doc.manufacturing) warnings.push('Manufacturing settings are not exported in .lcad; use Document JSON for a complete backup')
  const payload = { version: 2, name: doc.documentName ?? 'Untitled', unit_for_view: 'mm', gridSpacing: doc.snapSettings?.gridStep ?? 5, snapSpacing: 0.1, gridVisible: true, snapEnabled: doc.snapSettings?.enabled !== false, layers: doc.layers.map(layer => ({ id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, independent: layer.independent === true })), activeLayerId: doc.activeLayerId, palettes: doc.lineTypes.map(type => ({ id: type.id, name: type.name, colorDark: type.color, colorLight: type.color, strokeWidth: type.strokeWidthMm ?? 1, strokeDash: type.style, fillColor: 'none', alpha: 1, visible: type.visible })), activePaletteId: doc.activeLineTypeId, shapes, groups: (doc.sketchGroups ?? []).map(group => ({ id: group.id, name: group.name, visible: group.visible, locked: group.locked, parentId: group.parentId })), memo: doc.projectMemo ?? '', provenance: [], recording: { baseline: null, steps: [] }, ...(communityProvenance.length ? { leathercad: { version: 1, communityProvenance } } : {}) }
  return { text: JSON.stringify(payload, null, 2), warnings }
}
