import { isShapeLike, uid } from './cad/cad-geometry'
import type {
  AlignConstraint,
  DocFile,
  FoldLine,
  HardwareMarker,
  LineType,
  ParametricConstraint,
  SeamAllowance,
  Shape,
  SketchGroup,
  StitchHole,
  TracingOverlay,
} from './cad/cad-types'
import {
  normalizeLineTypes,
  parseLineType,
  resolveActiveLineTypeId,
  resolveShapeLineTypeId,
} from './cad/line-types'
import {
  parseConstraint,
  parseFoldLine,
  parseHardwareMarker,
  parseLayer,
  parseSeamAllowance,
  parseSketchGroup,
  parseSnapSettings,
  parseTracingOverlay,
} from './editor-parsers'
import { DEFAULT_SNAP_SETTINGS } from './editor-constants'
import { normalizeStitchHoleSequences, parseStitchHole } from './ops/stitch-hole-ops'

type ImportedJsonCandidate = {
  objects?: unknown[]
  foldLines?: unknown[]
  stitchHoles?: unknown[]
  constraints?: unknown[]
  seamAllowances?: unknown[]
  hardwareMarkers?: unknown[]
  sketchGroups?: unknown[]
  activeSketchGroupId?: unknown
  snapSettings?: unknown
  showAnnotations?: unknown
  tracingOverlays?: unknown[]
  layers?: unknown[]
  activeLayerId?: unknown
  lineTypes?: unknown[]
  activeLineTypeId?: unknown
}

export type ImportedJsonResult = {
  doc: DocFile
  summary: {
    shapeCount: number
    foldCount: number
    stitchHoleCount: number
    layerCount: number
    hardwareMarkerCount: number
  }
}

export function parseImportedJsonDocument(raw: string): ImportedJsonResult {
  const parsed = JSON.parse(raw) as ImportedJsonCandidate

  if (!Array.isArray(parsed.objects)) {
    throw new Error('Missing objects array')
  }

  const parsedLayers =
    Array.isArray(parsed.layers)
      ? parsed.layers.map(parseLayer).filter((layer): layer is NonNullable<ReturnType<typeof parseLayer>> => layer !== null)
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
  const nextLayerIdSet = new Set(nextLayers.map((layer) => layer.id))

  const nextSketchGroups = Array.isArray(parsed.sketchGroups)
    ? parsed.sketchGroups
        .map(parseSketchGroup)
        .filter((group): group is SketchGroup => group !== null && nextLayerIdSet.has(group.layerId))
    : []

  const nextSketchGroupIdSet = new Set(nextSketchGroups.map((group) => group.id))
  const nextSketchGroupById = Object.fromEntries(nextSketchGroups.map((group) => [group.id, group]))
  const nextActiveSketchGroupId =
    typeof parsed.activeSketchGroupId === 'string' && nextSketchGroupIdSet.has(parsed.activeSketchGroupId)
      ? parsed.activeSketchGroupId
      : null

  const parsedLineTypes = Array.isArray(parsed.lineTypes)
    ? parsed.lineTypes
        .map((candidate, index) => parseLineType(candidate, index))
        .filter((lineType): lineType is LineType => lineType !== null)
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
    const rawGroupId =
      typeof (candidate as { groupId?: unknown }).groupId === 'string'
        ? (candidate as { groupId: string }).groupId
        : null
    const groupId =
      rawGroupId && nextSketchGroupIdSet.has(rawGroupId) && nextSketchGroupById[rawGroupId]?.layerId === layerId
        ? rawGroupId
        : undefined

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
        groupId,
        start: candidate.start,
        end: candidate.end,
      })
    } else if (candidate.type === 'arc') {
      nextShapes.push({
        id: nextShapeId,
        type: 'arc',
        layerId,
        lineTypeId,
        groupId,
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
        groupId,
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
  const nextShapeIdSet = new Set(nextShapes.map((shape) => shape.id))

  const nextConstraints = Array.isArray(parsed.constraints)
    ? parsed.constraints
        .map(parseConstraint)
        .filter((constraint): constraint is ParametricConstraint => constraint !== null)
        .map((constraint) => {
          if (constraint.type === 'edge-offset') {
            return {
              ...constraint,
              shapeId: shapeIdMap.get(constraint.shapeId) ?? '',
            }
          }
          return {
            ...constraint,
            shapeId: shapeIdMap.get(constraint.shapeId) ?? '',
            referenceShapeId: shapeIdMap.get(constraint.referenceShapeId) ?? '',
          } as AlignConstraint
        })
        .filter((constraint) => {
          if (!nextShapeIdSet.has(constraint.shapeId)) {
            return false
          }
          if (constraint.type === 'edge-offset') {
            return nextLayerIdSet.has(constraint.referenceLayerId)
          }
          return nextShapeIdSet.has(constraint.referenceShapeId)
        })
    : []

  const nextSeamAllowances = Array.isArray(parsed.seamAllowances)
    ? parsed.seamAllowances
        .map(parseSeamAllowance)
        .filter((entry): entry is SeamAllowance => entry !== null)
        .map((entry) => ({
          ...entry,
          shapeId: shapeIdMap.get(entry.shapeId) ?? '',
        }))
        .filter((entry) => nextShapeIdSet.has(entry.shapeId))
    : []

  const nextHardwareMarkers = Array.isArray(parsed.hardwareMarkers)
    ? parsed.hardwareMarkers
        .map(parseHardwareMarker)
        .filter((marker): marker is HardwareMarker => marker !== null)
        .filter((marker) => {
          if (!nextLayerIdSet.has(marker.layerId)) {
            return false
          }
          if (!marker.groupId) {
            return true
          }
          return nextSketchGroupIdSet.has(marker.groupId)
        })
    : []

  const nextSnapSettings = parseSnapSettings(parsed.snapSettings) ?? DEFAULT_SNAP_SETTINGS
  const nextShowAnnotations = typeof parsed.showAnnotations === 'boolean' ? parsed.showAnnotations : true
  const nextTracingOverlays = Array.isArray(parsed.tracingOverlays)
    ? parsed.tracingOverlays
        .map(parseTracingOverlay)
        .filter((overlay): overlay is TracingOverlay => overlay !== null)
    : []

  return {
    doc: {
      version: 1,
      units: 'mm',
      layers: nextLayers,
      activeLayerId: nextActiveLayerId,
      sketchGroups: nextSketchGroups,
      activeSketchGroupId: nextActiveSketchGroupId,
      lineTypes: nextLineTypes,
      activeLineTypeId: nextActiveLineTypeId,
      objects: nextShapes,
      foldLines: nextFoldLines,
      stitchHoles: normalizedStitchHoles,
      constraints: nextConstraints,
      seamAllowances: nextSeamAllowances,
      hardwareMarkers: nextHardwareMarkers,
      snapSettings: nextSnapSettings,
      showAnnotations: nextShowAnnotations,
      tracingOverlays: nextTracingOverlays,
    },
    summary: {
      shapeCount: nextShapes.length,
      foldCount: nextFoldLines.length,
      stitchHoleCount: normalizedStitchHoles.length,
      layerCount: nextLayers.length,
      hardwareMarkerCount: nextHardwareMarkers.length,
    },
  }
}
