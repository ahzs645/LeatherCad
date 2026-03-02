import { clamp, isPointLike, uid } from './cad/cad-geometry'
import type {
  ConstraintAnchor,
  ConstraintAxis,
  ConstraintEdge,
  FoldLine,
  HardwareKind,
  HardwareMarker,
  Layer,
  ParametricConstraint,
  SeamAllowance,
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

export function parseSeamAllowance(value: unknown): SeamAllowance | null {
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
