import { clamp, isPointLike, uid } from './cad/cad-geometry'
import type {
  ConstraintAnchor,
  ConstraintAxis,
  ConstraintEdge,
  FoldLine,
  HardwareKind,
  HardwareMarker,
  LegacySeamAllowance,
  Layer,
  PatternPiece,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  SketchGroup,
  SnapSettings,
  TracingOverlay,
} from './cad/cad-types'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
  parseFoldDirection,
} from './ops/fold-line-ops'
import {
  DEFAULT_SEAM_ALLOWANCE_MM,
  DEFAULT_SNAP_SETTINGS,
  HARDWARE_PRESETS,
} from './editor-constants'
import type { DimensionLine, PrintArea } from './cad/cad-types'

export function parseFoldLine(value: unknown): FoldLine | null {
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
    direction?: unknown
    radiusMm?: unknown
    thicknessMm?: unknown
    neutralAxisRatio?: unknown
    stiffness?: unknown
    clearanceMm?: unknown
  }

  if (!isPointLike(candidate.start) || !isPointLike(candidate.end)) {
    return null
  }

  return sanitizeFoldLine({
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Fold',
    start: candidate.start,
    end: candidate.end,
    angleDeg: typeof candidate.angleDeg === 'number' ? candidate.angleDeg : 0,
    maxAngleDeg: typeof candidate.maxAngleDeg === 'number' ? candidate.maxAngleDeg : 180,
    direction: candidate.direction as FoldLine['direction'],
    radiusMm: typeof candidate.radiusMm === 'number' ? candidate.radiusMm : DEFAULT_FOLD_RADIUS_MM,
    thicknessMm: typeof candidate.thicknessMm === 'number' ? candidate.thicknessMm : DEFAULT_FOLD_THICKNESS_MM,
    neutralAxisRatio:
      typeof candidate.neutralAxisRatio === 'number'
        ? candidate.neutralAxisRatio
        : DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
    stiffness: typeof candidate.stiffness === 'number' ? candidate.stiffness : DEFAULT_FOLD_STIFFNESS,
    clearanceMm: typeof candidate.clearanceMm === 'number' ? candidate.clearanceMm : DEFAULT_FOLD_CLEARANCE_MM,
  })
}

export function sanitizeFoldLine(foldLine: FoldLine): FoldLine {
  const maxAngleDeg = Number.isFinite(foldLine.maxAngleDeg) ? clamp(foldLine.maxAngleDeg, 10, 180) : 180
  return {
    ...foldLine,
    angleDeg: Number.isFinite(foldLine.angleDeg) ? clamp(foldLine.angleDeg, -maxAngleDeg, maxAngleDeg) : 0,
    maxAngleDeg,
    direction: parseFoldDirection(foldLine.direction) ?? DEFAULT_FOLD_DIRECTION,
    radiusMm: Number.isFinite(foldLine.radiusMm) ? clamp(foldLine.radiusMm ?? DEFAULT_FOLD_RADIUS_MM, 0, 30) : DEFAULT_FOLD_RADIUS_MM,
    thicknessMm: Number.isFinite(foldLine.thicknessMm)
      ? clamp(foldLine.thicknessMm ?? DEFAULT_FOLD_THICKNESS_MM, 0.2, 20)
      : DEFAULT_FOLD_THICKNESS_MM,
    neutralAxisRatio: Number.isFinite(foldLine.neutralAxisRatio)
      ? clamp(foldLine.neutralAxisRatio ?? DEFAULT_FOLD_NEUTRAL_AXIS_RATIO, 0, 1)
      : DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
    stiffness: Number.isFinite(foldLine.stiffness)
      ? clamp(foldLine.stiffness ?? DEFAULT_FOLD_STIFFNESS, 0, 1)
      : DEFAULT_FOLD_STIFFNESS,
    clearanceMm: Number.isFinite(foldLine.clearanceMm)
      ? clamp(foldLine.clearanceMm ?? DEFAULT_FOLD_CLEARANCE_MM, 0, 20)
      : DEFAULT_FOLD_CLEARANCE_MM,
  }
}

export function parseLayer(value: unknown): Layer | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    visible?: unknown
    locked?: unknown
    stackLevel?: unknown
    annotation?: unknown
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
    annotation: typeof candidate.annotation === 'string' ? candidate.annotation : undefined,
  }
}

export function parseSketchGroup(value: unknown): SketchGroup | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    layerId?: unknown
    visible?: unknown
    locked?: unknown
    annotation?: unknown
    baseGroupId?: unknown
    linkMode?: unknown
    linkOffsetX?: unknown
    linkOffsetY?: unknown
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.layerId !== 'string' || candidate.layerId.length === 0) {
    return null
  }

  const hasBaseGroup = typeof candidate.baseGroupId === 'string' && candidate.baseGroupId.length > 0
  const linkMode =
    candidate.linkMode === 'copy' || candidate.linkMode === 'mirror-x' || candidate.linkMode === 'mirror-y'
      ? candidate.linkMode
      : 'copy'

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : 'Sub-Sketch',
    layerId: candidate.layerId,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : false,
    annotation: typeof candidate.annotation === 'string' ? candidate.annotation : undefined,
    baseGroupId: hasBaseGroup ? (candidate.baseGroupId as string) : undefined,
    linkMode: hasBaseGroup ? linkMode : undefined,
    linkOffsetX:
      hasBaseGroup && typeof candidate.linkOffsetX === 'number' && Number.isFinite(candidate.linkOffsetX)
        ? candidate.linkOffsetX
        : hasBaseGroup
          ? 0
          : undefined,
    linkOffsetY:
      hasBaseGroup && typeof candidate.linkOffsetY === 'number' && Number.isFinite(candidate.linkOffsetY)
        ? candidate.linkOffsetY
        : hasBaseGroup
          ? 0
          : undefined,
  }
}

export function parseLegacySeamAllowance(value: unknown): LegacySeamAllowance | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    shapeId?: unknown
    offsetMm?: unknown
  }

  if (typeof candidate.shapeId !== 'string' || candidate.shapeId.length === 0) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    shapeId: candidate.shapeId,
    offsetMm:
      typeof candidate.offsetMm === 'number' && Number.isFinite(candidate.offsetMm)
        ? Math.max(0.1, Math.abs(candidate.offsetMm))
        : DEFAULT_SEAM_ALLOWANCE_MM,
  }
}

export function parsePatternPiece(value: unknown): PatternPiece | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PatternPiece>
  if (typeof candidate.id !== 'string' || typeof candidate.boundaryShapeId !== 'string' || typeof candidate.layerId !== 'string') {
    return null
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : 'Pattern Piece',
    boundaryShapeId: candidate.boundaryShapeId,
    internalShapeIds: Array.isArray(candidate.internalShapeIds)
      ? candidate.internalShapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string')
      : [],
    layerId: candidate.layerId,
    quantity:
      typeof candidate.quantity === 'number' && Number.isFinite(candidate.quantity)
        ? Math.max(1, Math.round(candidate.quantity))
        : 1,
    code: typeof candidate.code === 'string' && candidate.code.trim().length > 0 ? candidate.code.trim() : undefined,
    annotation: typeof candidate.annotation === 'string' ? candidate.annotation : undefined,
    material: typeof candidate.material === 'string' && candidate.material.trim().length > 0 ? candidate.material.trim() : undefined,
    materialSide:
      candidate.materialSide === 'grain' || candidate.materialSide === 'flesh' || candidate.materialSide === 'either'
        ? candidate.materialSide
        : 'either',
    notes: typeof candidate.notes === 'string' && candidate.notes.trim().length > 0 ? candidate.notes.trim() : undefined,
    onFold: candidate.onFold === true,
    mirrorPair: candidate.mirrorPair === true,
    orientation:
      candidate.orientation === 'horizontal' || candidate.orientation === 'vertical' || candidate.orientation === 'any'
        ? candidate.orientation
        : 'any',
    allowFlip: candidate.allowFlip !== false,
    includeInLayout: candidate.includeInLayout !== false,
    locked: candidate.locked === true,
    color: typeof candidate.color === 'string' ? candidate.color : undefined,
    fill: typeof candidate.fill === 'string' ? candidate.fill : undefined,
  }
}

export function parsePieceGrainline(value: unknown): PieceGrainline | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PieceGrainline>
  if (typeof candidate.pieceId !== 'string') {
    return null
  }

  return {
    pieceId: candidate.pieceId,
    visible: candidate.visible !== false,
    mode: candidate.mode === 'fixed' ? 'fixed' : 'auto',
    lengthMm:
      typeof candidate.lengthMm === 'number' && Number.isFinite(candidate.lengthMm)
        ? Math.max(0.1, Math.abs(candidate.lengthMm))
        : undefined,
    rotationDeg: typeof candidate.rotationDeg === 'number' && Number.isFinite(candidate.rotationDeg) ? candidate.rotationDeg : 90,
    anchor: 'center',
  }
}

export function parsePieceLabel(value: unknown): PieceLabel | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PieceLabel>
  if (typeof candidate.id !== 'string' || typeof candidate.pieceId !== 'string') {
    return null
  }
  return {
    id: candidate.id,
    pieceId: candidate.pieceId,
    visible: candidate.visible !== false,
    kind: candidate.kind === 'pattern' ? 'pattern' : 'piece',
    textTemplate: typeof candidate.textTemplate === 'string' ? candidate.textTemplate : '{{name}}',
    rotationDeg: typeof candidate.rotationDeg === 'number' && Number.isFinite(candidate.rotationDeg) ? candidate.rotationDeg : 0,
    anchor: 'center',
    offsetX: typeof candidate.offsetX === 'number' && Number.isFinite(candidate.offsetX) ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' && Number.isFinite(candidate.offsetY) ? candidate.offsetY : 0,
    fontSizeMm:
      typeof candidate.fontSizeMm === 'number' && Number.isFinite(candidate.fontSizeMm)
        ? Math.max(2, candidate.fontSizeMm)
        : 8,
  }
}

export function parsePiecePlacementLabel(value: unknown): PiecePlacementLabel | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PiecePlacementLabel>
  if (typeof candidate.id !== 'string' || typeof candidate.pieceId !== 'string') {
    return null
  }

  return {
    id: candidate.id,
    pieceId: candidate.pieceId,
    name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : 'Placement Label',
    visible: candidate.visible !== false,
    kind:
      candidate.kind === 'box' || candidate.kind === 'circle' || candidate.kind === 'text'
        ? candidate.kind
        : 'cross',
    anchor: candidate.anchor === 'edge' ? 'edge' : 'center',
    edgeIndex:
      typeof candidate.edgeIndex === 'number' && Number.isFinite(candidate.edgeIndex)
        ? Math.max(0, Math.round(candidate.edgeIndex))
        : 0,
    t: typeof candidate.t === 'number' && Number.isFinite(candidate.t) ? clamp(candidate.t, 0, 1) : 0.5,
    offsetX: typeof candidate.offsetX === 'number' && Number.isFinite(candidate.offsetX) ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' && Number.isFinite(candidate.offsetY) ? candidate.offsetY : 0,
    widthMm:
      typeof candidate.widthMm === 'number' && Number.isFinite(candidate.widthMm)
        ? Math.max(1, Math.abs(candidate.widthMm))
        : 6,
    heightMm:
      typeof candidate.heightMm === 'number' && Number.isFinite(candidate.heightMm)
        ? Math.max(1, Math.abs(candidate.heightMm))
        : 6,
    rotationDeg: typeof candidate.rotationDeg === 'number' && Number.isFinite(candidate.rotationDeg) ? candidate.rotationDeg : 0,
    text: typeof candidate.text === 'string' && candidate.text.trim().length > 0 ? candidate.text.trim() : undefined,
    showOnSeam: candidate.showOnSeam === true,
  }
}

export function parsePieceSeamAllowance(value: unknown): PieceSeamAllowance | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PieceSeamAllowance>
  if (typeof candidate.pieceId !== 'string') {
    return null
  }
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    pieceId: candidate.pieceId,
    enabled: candidate.enabled !== false,
    defaultOffsetMm:
      typeof candidate.defaultOffsetMm === 'number' && Number.isFinite(candidate.defaultOffsetMm)
        ? Math.max(0.1, Math.abs(candidate.defaultOffsetMm))
        : DEFAULT_SEAM_ALLOWANCE_MM,
    edgeOverrides: Array.isArray(candidate.edgeOverrides)
      ? candidate.edgeOverrides
          .filter(
            (entry): entry is { edgeIndex: number; offsetMm: number } =>
              typeof entry === 'object' &&
              entry !== null &&
              typeof (entry as { edgeIndex?: unknown }).edgeIndex === 'number' &&
              typeof (entry as { offsetMm?: unknown }).offsetMm === 'number',
          )
          .map((entry) => ({
            edgeIndex: Math.max(0, Math.round(entry.edgeIndex)),
            offsetMm: Math.max(0.1, Math.abs(entry.offsetMm)),
          }))
      : [],
  }
}

export function parsePieceNotch(value: unknown): PieceNotch | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PieceNotch>
  if (typeof candidate.id !== 'string' || typeof candidate.pieceId !== 'string') {
    return null
  }
  return {
    id: candidate.id,
    pieceId: candidate.pieceId,
    edgeIndex: typeof candidate.edgeIndex === 'number' && Number.isFinite(candidate.edgeIndex) ? Math.max(0, Math.round(candidate.edgeIndex)) : 0,
    t: typeof candidate.t === 'number' && Number.isFinite(candidate.t) ? clamp(candidate.t, 0, 1) : 0.5,
    style: candidate.style === 'double' || candidate.style === 'v' ? candidate.style : 'single',
    lengthMm: typeof candidate.lengthMm === 'number' && Number.isFinite(candidate.lengthMm) ? Math.max(0.5, candidate.lengthMm) : 4,
    widthMm: typeof candidate.widthMm === 'number' && Number.isFinite(candidate.widthMm) ? Math.max(0, candidate.widthMm) : 2,
    angleMode: candidate.angleMode === 'fixed' ? 'fixed' : 'normal',
    angleDeg: typeof candidate.angleDeg === 'number' && Number.isFinite(candidate.angleDeg) ? candidate.angleDeg : undefined,
    showOnSeam: candidate.showOnSeam === true,
  }
}

export function parseHardwareMarker(value: unknown): HardwareMarker | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    layerId?: unknown
    groupId?: unknown
    point?: unknown
    kind?: unknown
    label?: unknown
    holeDiameterMm?: unknown
    spacingMm?: unknown
    notes?: unknown
    visible?: unknown
  }

  if (typeof candidate.layerId !== 'string' || candidate.layerId.length === 0 || !isPointLike(candidate.point)) {
    return null
  }

  const kind: HardwareKind =
    candidate.kind === 'snap' || candidate.kind === 'rivet' || candidate.kind === 'buckle' || candidate.kind === 'custom'
      ? candidate.kind
      : 'snap'

  const fallbackPreset = kind === 'custom' ? HARDWARE_PRESETS.snap : HARDWARE_PRESETS[kind]

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    layerId: candidate.layerId,
    groupId: typeof candidate.groupId === 'string' && candidate.groupId.length > 0 ? candidate.groupId : undefined,
    point: candidate.point,
    kind,
    label:
      typeof candidate.label === 'string' && candidate.label.trim().length > 0
        ? candidate.label.trim()
        : kind === 'custom'
          ? 'Hardware'
          : fallbackPreset.label,
    holeDiameterMm:
      typeof candidate.holeDiameterMm === 'number' && Number.isFinite(candidate.holeDiameterMm)
        ? Math.max(0.1, Math.abs(candidate.holeDiameterMm))
        : fallbackPreset.holeDiameterMm,
    spacingMm:
      typeof candidate.spacingMm === 'number' && Number.isFinite(candidate.spacingMm)
        ? Math.max(0, candidate.spacingMm)
        : fallbackPreset.spacingMm,
    notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
  }
}

function parseConstraintAnchor(value: unknown): ConstraintAnchor {
  if (value === 'start' || value === 'end' || value === 'mid' || value === 'center') {
    return value
  }
  return 'center'
}

export function parseConstraint(value: unknown): ParametricConstraint | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    name?: unknown
    type?: unknown
    enabled?: unknown
    shapeId?: unknown
    referenceLayerId?: unknown
    edge?: unknown
    anchor?: unknown
    offsetMm?: unknown
    referenceShapeId?: unknown
    axis?: unknown
    referenceAnchor?: unknown
  }

  if (typeof candidate.shapeId !== 'string' || candidate.shapeId.length === 0) {
    return null
  }

  const id = typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid()
  const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : 'Constraint'
  const enabled = typeof candidate.enabled === 'boolean' ? candidate.enabled : true

  if (candidate.type === 'edge-offset') {
    if (typeof candidate.referenceLayerId !== 'string' || candidate.referenceLayerId.length === 0) {
      return null
    }
    const edge: ConstraintEdge =
      candidate.edge === 'left' || candidate.edge === 'right' || candidate.edge === 'top' || candidate.edge === 'bottom'
        ? candidate.edge
        : 'left'
    return {
      id,
      name,
      type: 'edge-offset',
      enabled,
      shapeId: candidate.shapeId,
      referenceLayerId: candidate.referenceLayerId,
      edge,
      anchor: parseConstraintAnchor(candidate.anchor),
      offsetMm:
        typeof candidate.offsetMm === 'number' && Number.isFinite(candidate.offsetMm)
          ? Math.max(0, candidate.offsetMm)
          : 10,
    }
  }

  if (candidate.type === 'align') {
    if (typeof candidate.referenceShapeId !== 'string' || candidate.referenceShapeId.length === 0) {
      return null
    }
    const axis: ConstraintAxis = candidate.axis === 'x' || candidate.axis === 'y' || candidate.axis === 'both' ? candidate.axis : 'x'
    return {
      id,
      name,
      type: 'align',
      enabled,
      shapeId: candidate.shapeId,
      referenceShapeId: candidate.referenceShapeId,
      axis,
      anchor: parseConstraintAnchor(candidate.anchor),
      referenceAnchor: parseConstraintAnchor(candidate.referenceAnchor),
    }
  }

  return null
}

export function parseSnapSettings(value: unknown): SnapSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<SnapSettings>
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : DEFAULT_SNAP_SETTINGS.enabled,
    grid: typeof candidate.grid === 'boolean' ? candidate.grid : DEFAULT_SNAP_SETTINGS.grid,
    gridStep:
      typeof candidate.gridStep === 'number' && Number.isFinite(candidate.gridStep)
        ? Math.max(0.1, candidate.gridStep)
        : DEFAULT_SNAP_SETTINGS.gridStep,
    endpoints: typeof candidate.endpoints === 'boolean' ? candidate.endpoints : DEFAULT_SNAP_SETTINGS.endpoints,
    midpoints: typeof candidate.midpoints === 'boolean' ? candidate.midpoints : DEFAULT_SNAP_SETTINGS.midpoints,
    guides: typeof candidate.guides === 'boolean' ? candidate.guides : DEFAULT_SNAP_SETTINGS.guides,
    hardware: typeof candidate.hardware === 'boolean' ? candidate.hardware : DEFAULT_SNAP_SETTINGS.hardware,
  }
}

export function parseDimensionLine(value: unknown): DimensionLine | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    start?: unknown
    end?: unknown
    offsetMm?: unknown
    text?: unknown
    layerId?: unknown
    lineTypeId?: unknown
  }

  if (!isPointLike(candidate.start) || !isPointLike(candidate.end)) {
    return null
  }
  if (typeof candidate.layerId !== 'string' || candidate.layerId.length === 0) {
    return null
  }
  if (typeof candidate.lineTypeId !== 'string' || candidate.lineTypeId.length === 0) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    start: candidate.start,
    end: candidate.end,
    offsetMm:
      typeof candidate.offsetMm === 'number' && Number.isFinite(candidate.offsetMm)
        ? candidate.offsetMm
        : 5,
    text: typeof candidate.text === 'string' ? candidate.text : undefined,
    layerId: candidate.layerId,
    lineTypeId: candidate.lineTypeId,
  }
}

export function parsePrintArea(value: unknown): PrintArea | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    offsetX?: unknown
    offsetY?: unknown
    widthMm?: unknown
    heightMm?: unknown
    scalePercent?: unknown
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    offsetX: typeof candidate.offsetX === 'number' && Number.isFinite(candidate.offsetX) ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' && Number.isFinite(candidate.offsetY) ? candidate.offsetY : 0,
    widthMm:
      typeof candidate.widthMm === 'number' && Number.isFinite(candidate.widthMm) && candidate.widthMm > 0
        ? candidate.widthMm
        : 210,
    heightMm:
      typeof candidate.heightMm === 'number' && Number.isFinite(candidate.heightMm) && candidate.heightMm > 0
        ? candidate.heightMm
        : 297,
    scalePercent:
      typeof candidate.scalePercent === 'number' && Number.isFinite(candidate.scalePercent) && candidate.scalePercent > 0
        ? candidate.scalePercent
        : 100,
  }
}

export function parseTracingOverlay(value: unknown): TracingOverlay | null {
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
    pdfSourceUrl: typeof candidate.pdfSourceUrl === 'string' && candidate.pdfSourceUrl.length > 0 ? candidate.pdfSourceUrl : undefined,
    pdfPageNumber:
      typeof candidate.pdfPageNumber === 'number' && Number.isFinite(candidate.pdfPageNumber) && candidate.pdfPageNumber > 0
        ? Math.round(candidate.pdfPageNumber)
        : undefined,
    pdfPageCount:
      typeof candidate.pdfPageCount === 'number' && Number.isFinite(candidate.pdfPageCount) && candidate.pdfPageCount > 0
        ? Math.round(candidate.pdfPageCount)
        : undefined,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : true,
    opacity: typeof candidate.opacity === 'number' ? clamp(candidate.opacity, 0.05, 1) : 0.75,
    scale: typeof candidate.scale === 'number' ? clamp(candidate.scale, 0.05, 20) : 1,
    rotationDeg: typeof candidate.rotationDeg === 'number' ? candidate.rotationDeg : 0,
    offsetX: typeof candidate.offsetX === 'number' ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' ? candidate.offsetY : 0,
    width: typeof candidate.width === 'number' && candidate.width > 0 ? candidate.width : 800,
    height: typeof candidate.height === 'number' && candidate.height > 0 ? candidate.height : 800,
    isObjectUrl: typeof candidate.isObjectUrl === 'boolean' ? candidate.isObjectUrl : false,
  }
}
