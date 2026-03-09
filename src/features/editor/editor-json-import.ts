import { isShapeLike, uid } from './cad/cad-geometry'
import type {
  AlignConstraint,
  DimensionLine,
  DocFile,
  FoldLine,
  HardwareMarker,
  LegacySeamAllowance,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  PrintArea,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  TextureSource,
  TracingOverlay,
  AvatarSpec,
} from './cad/cad-types'
import {
  normalizeLineTypes,
  parseLineType,
  resolveActiveLineTypeId,
  resolveShapeLineTypeId,
} from './cad/line-types'
import {
  parseConstraint,
  parseDimensionLine,
  parseFoldLine,
  parseHardwareMarker,
  parseLayer,
  parseLegacySeamAllowance,
  parsePatternPiece,
  parsePieceGrainline,
  parsePieceLabel,
  parsePiecePlacement3d,
  parsePiecePlacementLabel,
  parsePieceNotch,
  parsePieceSeamAllowance,
  parsePrintArea,
  parseSeamConnection,
  parseSketchGroup,
  parseSnapSettings,
  parseThreePreviewSettings,
  parseTracingOverlay,
  parseAvatarSpec,
} from './editor-parsers'
import { DEFAULT_SNAP_SETTINGS, DEFAULT_THREE_PREVIEW_SETTINGS } from './editor-constants'
import { normalizeStitchHoleSequences, parseStitchHole } from './ops/stitch-hole-ops'
import { sanitizeSketchGroupLinks } from './ops/sketch-link-ops'
import { migrateLegacySeamAllowances } from './ops/pattern-piece-ops'

type ImportedJsonCandidate = {
  objects?: unknown[]
  foldLines?: unknown[]
  stitchHoles?: unknown[]
  constraints?: unknown[]
  seamAllowances?: unknown[]
  patternPieces?: unknown[]
  pieceGrainlines?: unknown[]
  pieceLabels?: unknown[]
  piecePlacementLabels?: unknown[]
  piecePlacements3d?: unknown[]
  seamConnections?: unknown[]
  pieceNotches?: unknown[]
  hardwareMarkers?: unknown[]
  sketchGroups?: unknown[]
  activeSketchGroupId?: unknown
  snapSettings?: unknown
  showAnnotations?: unknown
  tracingOverlays?: unknown[]
  projectMemo?: unknown
  stitchAlwaysShapeIds?: unknown[]
  stitchThreadColor?: unknown
  threePreviewSettings?: unknown
  avatars?: unknown[]
  threeTextureSource?: unknown
  threeTextureShapeIds?: unknown[]
  showCanvasRuler?: unknown
  showDimensions?: unknown
  dimensionLines?: unknown[]
  printAreas?: unknown[]
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

  const nextSketchGroups = sanitizeSketchGroupLinks(
    Array.isArray(parsed.sketchGroups)
      ? parsed.sketchGroups
          .map(parseSketchGroup)
          .filter((group): group is SketchGroup => group !== null && nextLayerIdSet.has(group.layerId))
      : [],
  )

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

    const arrowStart =
      typeof (candidate as { arrowStart?: unknown }).arrowStart === 'boolean'
        ? (candidate as { arrowStart: boolean }).arrowStart
        : undefined
    const arrowEnd =
      typeof (candidate as { arrowEnd?: unknown }).arrowEnd === 'boolean'
        ? (candidate as { arrowEnd: boolean }).arrowEnd
        : undefined

    if (candidate.type === 'line') {
      nextShapes.push({
        id: nextShapeId,
        type: 'line',
        layerId,
        lineTypeId,
        groupId,
        arrowStart,
        arrowEnd,
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
        arrowStart,
        arrowEnd,
        start: candidate.start,
        mid: candidate.mid,
        end: candidate.end,
      })
    } else if (candidate.type === 'bezier') {
      nextShapes.push({
        id: nextShapeId,
        type: 'bezier',
        layerId,
        lineTypeId,
        groupId,
        arrowStart,
        arrowEnd,
        start: candidate.start,
        control: candidate.control,
        end: candidate.end,
      })
    } else {
      nextShapes.push({
        id: nextShapeId,
        type: 'text',
        layerId,
        lineTypeId,
        groupId,
        start: candidate.start,
        end: candidate.end,
        text: candidate.text,
        fontFamily: candidate.fontFamily,
        fontSizeMm: candidate.fontSizeMm,
        transform: candidate.transform,
        radiusMm: candidate.radiusMm,
        sweepDeg: candidate.sweepDeg,
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
  const projectMemo = typeof parsed.projectMemo === 'string' ? parsed.projectMemo.slice(0, 8000) : ''
  const stitchAlwaysShapeIds = Array.isArray(parsed.stitchAlwaysShapeIds)
    ? parsed.stitchAlwaysShapeIds
        .map((shapeId) => (typeof shapeId === 'string' ? shapeIdMap.get(shapeId) ?? null : null))
        .filter((shapeId): shapeId is string => typeof shapeId === 'string' && nextShapeIdSet.has(shapeId))
    : []
  const stitchThreadColor =
    typeof parsed.stitchThreadColor === 'string' && parsed.stitchThreadColor.trim().length > 0
      ? parsed.stitchThreadColor
      : '#fb923c'
  const threePreviewSettings = parseThreePreviewSettings(parsed.threePreviewSettings) ?? DEFAULT_THREE_PREVIEW_SETTINGS
  const avatars = Array.isArray(parsed.avatars)
    ? parsed.avatars
        .map(parseAvatarSpec)
        .filter((avatar): avatar is AvatarSpec => avatar !== null)
    : []
  const threeTextureSource =
    parsed.threeTextureSource &&
    typeof parsed.threeTextureSource === 'object' &&
    typeof (parsed.threeTextureSource as TextureSource).albedoUrl === 'string' &&
    (parsed.threeTextureSource as TextureSource).albedoUrl.trim().length > 0
      ? (parsed.threeTextureSource as TextureSource)
      : null
  const threeTextureShapeIds = Array.isArray(parsed.threeTextureShapeIds)
    ? parsed.threeTextureShapeIds
        .map((shapeId) => (typeof shapeId === 'string' ? shapeIdMap.get(shapeId) ?? null : null))
        .filter((shapeId): shapeId is string => typeof shapeId === 'string' && nextShapeIdSet.has(shapeId))
    : []
  const showCanvasRuler = typeof parsed.showCanvasRuler === 'boolean' ? parsed.showCanvasRuler : true
  const showDimensions = typeof parsed.showDimensions === 'boolean' ? parsed.showDimensions : false

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

  const nextPatternPieces = Array.isArray(parsed.patternPieces)
    ? parsed.patternPieces
        .map(parsePatternPiece)
        .filter((piece): piece is PatternPiece => piece !== null)
        .map((piece) => ({
          ...piece,
          boundaryShapeId: shapeIdMap.get(piece.boundaryShapeId) ?? '',
          internalShapeIds: piece.internalShapeIds
            .map((shapeId) => shapeIdMap.get(shapeId) ?? '')
            .filter((shapeId) => nextShapeIdSet.has(shapeId)),
        }))
        .filter((piece) => nextShapeIdSet.has(piece.boundaryShapeId) && nextLayerIdSet.has(piece.layerId))
    : []

  const nextPatternPieceIdSet = new Set(nextPatternPieces.map((piece) => piece.id))
  const nextPieceGrainlines = Array.isArray(parsed.pieceGrainlines)
    ? parsed.pieceGrainlines
        .map(parsePieceGrainline)
        .filter((grainline): grainline is PieceGrainline => grainline !== null && nextPatternPieceIdSet.has(grainline.pieceId))
    : []
  const nextPieceLabels = Array.isArray(parsed.pieceLabels)
    ? parsed.pieceLabels
        .map(parsePieceLabel)
        .filter((label): label is PieceLabel => label !== null && nextPatternPieceIdSet.has(label.pieceId))
    : []
  const nextPiecePlacementLabels = Array.isArray(parsed.piecePlacementLabels)
    ? parsed.piecePlacementLabels
        .map(parsePiecePlacementLabel)
        .filter((label): label is PiecePlacementLabel => label !== null && nextPatternPieceIdSet.has(label.pieceId))
    : []
  const nextPiecePlacements3d = Array.isArray(parsed.piecePlacements3d)
    ? parsed.piecePlacements3d
        .map(parsePiecePlacement3d)
        .filter((placement): placement is PiecePlacement3D => placement !== null && nextPatternPieceIdSet.has(placement.pieceId))
    : []
  const nextSeamConnections = Array.isArray(parsed.seamConnections)
    ? parsed.seamConnections
        .map(parseSeamConnection)
        .filter(
          (connection): connection is SeamConnection =>
            connection !== null &&
            nextPatternPieceIdSet.has(connection.from.pieceId) &&
            nextPatternPieceIdSet.has(connection.to.pieceId),
        )
    : []
  const nextPieceNotches = Array.isArray(parsed.pieceNotches)
    ? parsed.pieceNotches
        .map(parsePieceNotch)
        .filter((notch): notch is PieceNotch => notch !== null && nextPatternPieceIdSet.has(notch.pieceId))
    : []

  const nextLegacySeamAllowances = Array.isArray(parsed.seamAllowances)
    ? parsed.seamAllowances
        .map(parseLegacySeamAllowance)
        .filter((entry): entry is LegacySeamAllowance => entry !== null)
        .map((entry) => ({
          ...entry,
          shapeId: shapeIdMap.get(entry.shapeId) ?? '',
        }))
        .filter((entry) => nextShapeIdSet.has(entry.shapeId))
    : []
  const nextPieceSeamAllowances = Array.isArray(parsed.seamAllowances)
    ? parsed.seamAllowances
        .map(parsePieceSeamAllowance)
        .filter((entry): entry is PieceSeamAllowance => entry !== null && nextPatternPieceIdSet.has(entry.pieceId))
    : []
  const nextSeamAllowances = [...nextPieceSeamAllowances, ...migrateLegacySeamAllowances(nextLegacySeamAllowances, nextPatternPieces)]

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

  const nextDimensionLines = Array.isArray(parsed.dimensionLines)
    ? parsed.dimensionLines
        .map(parseDimensionLine)
        .filter((dim): dim is DimensionLine => dim !== null)
        .filter((dim) => nextLayerIdSet.has(dim.layerId))
    : []

  const nextPrintAreas = Array.isArray(parsed.printAreas)
    ? parsed.printAreas
        .map(parsePrintArea)
        .filter((area): area is PrintArea => area !== null)
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
      patternPieces: nextPatternPieces,
      pieceGrainlines: nextPieceGrainlines,
      pieceLabels: nextPieceLabels,
      piecePlacementLabels: nextPiecePlacementLabels,
      piecePlacements3d: nextPiecePlacements3d,
      seamConnections: nextSeamConnections,
      seamAllowances: nextSeamAllowances,
      pieceNotches: nextPieceNotches,
      hardwareMarkers: nextHardwareMarkers,
      snapSettings: nextSnapSettings,
      showAnnotations: nextShowAnnotations,
      tracingOverlays: nextTracingOverlays,
      projectMemo,
      stitchAlwaysShapeIds,
      stitchThreadColor,
      threePreviewSettings,
      avatars,
      threeTextureSource,
      threeTextureShapeIds,
      showCanvasRuler,
      showDimensions,
      dimensionLines: nextDimensionLines,
      printAreas: nextPrintAreas,
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
