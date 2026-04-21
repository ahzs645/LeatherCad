import { useMemo, type Dispatch, type SetStateAction } from 'react'
import type {
  DocFile,
  Shape,
  StitchHole,
} from './cad/cad-types'
import { DEFAULT_EXPORT_ROLE_FILTERS } from './editor-constants'
import type { DxfVersion, ExportRoleFilters, StitchHoleExportRenderMode } from './editor-types'

type UseEditorDocumentCommandsParams = {
  documentName: string | null
  layers: DocFile['layers']
  activeLayerId: string
  sketchGroups: DocFile['sketchGroups']
  activeSketchGroupId: string | null
  lineTypes: DocFile['lineTypes']
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: DocFile['foldLines']
  stitchHoles: StitchHole[]
  constraints: DocFile['constraints']
  patternPieces: DocFile['patternPieces']
  pieceGrainlines: DocFile['pieceGrainlines']
  pieceLabels: DocFile['pieceLabels']
  piecePlacementLabels: DocFile['piecePlacementLabels']
  piecePlacements3d: DocFile['piecePlacements3d']
  seamConnections: DocFile['seamConnections']
  seamAllowances: DocFile['seamAllowances']
  pieceNotches: DocFile['pieceNotches']
  hardwareMarkers: DocFile['hardwareMarkers']
  snapSettings: DocFile['snapSettings']
  showAnnotations: boolean
  tracingOverlays: DocFile['tracingOverlays']
  backdrops: DocFile['backdrops']
  projectMemo: string
  stitchAlwaysShapeIds: string[]
  stitchThreadColor: string
  threePreviewSettings: DocFile['threePreviewSettings']
  avatars: DocFile['avatars']
  threeTextureSource: DocFile['threeTextureSource']
  threeTextureShapeIds: string[]
  leatherImageFills: DocFile['leatherImageFills']
  activeLeatherImageFillId: string | null
  showCanvasRuler: boolean
  showDimensions: boolean
  dimensionLines: DocFile['dimensionLines']
  printAreas: DocFile['printAreas']
  selectedShapeIdSet: Set<string>
  selectedEditableShape: Shape | null
  selectedStitchHole: StitchHole | null
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setStitchAlwaysShapeIds: Dispatch<SetStateAction<string[]>>
  setExportOnlySelectedShapes: Dispatch<SetStateAction<boolean>>
  setExportOnlyVisibleLineTypes: Dispatch<SetStateAction<boolean>>
  setExportRoleFilters: Dispatch<SetStateAction<ExportRoleFilters>>
  setExportForceSolidStrokes: Dispatch<SetStateAction<boolean>>
  setExportStitchHoleRenderMode: Dispatch<SetStateAction<StitchHoleExportRenderMode>>
  setExportStitchDotRadiusMm: Dispatch<SetStateAction<number>>
  setDxfFlipY: Dispatch<SetStateAction<boolean>>
  setDxfVersion: Dispatch<SetStateAction<DxfVersion>>
  setFoldLines: Dispatch<SetStateAction<DocFile['foldLines']>>
  setStatus: (status: string) => void
}

export function useEditorDocumentCommands({
  documentName,
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
  patternPieces,
  pieceGrainlines,
  pieceLabels,
  piecePlacementLabels,
  piecePlacements3d,
  seamConnections,
  seamAllowances,
  pieceNotches,
  hardwareMarkers,
  snapSettings,
  showAnnotations,
  tracingOverlays,
  backdrops,
  projectMemo,
  stitchAlwaysShapeIds,
  stitchThreadColor,
  threePreviewSettings,
  avatars,
  threeTextureSource,
  threeTextureShapeIds,
  leatherImageFills,
  activeLeatherImageFillId,
  showCanvasRuler,
  showDimensions,
  dimensionLines,
  printAreas,
  selectedShapeIdSet,
  selectedEditableShape,
  selectedStitchHole,
  setShapes,
  setStitchHoles,
  setStitchAlwaysShapeIds,
  setExportOnlySelectedShapes,
  setExportOnlyVisibleLineTypes,
  setExportRoleFilters,
  setExportForceSolidStrokes,
  setExportStitchHoleRenderMode,
  setExportStitchDotRadiusMm,
  setDxfFlipY,
  setDxfVersion,
  setFoldLines,
  setStatus,
}: UseEditorDocumentCommandsParams) {
  const buildCurrentDocFile = useMemo(
    () => (): DocFile => ({
      version: 1,
      units: 'mm',
      ...(documentName ? { documentName } : {}),
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
      patternPieces,
      pieceGrainlines,
      pieceLabels,
      piecePlacementLabels,
      seamAllowances,
      pieceNotches,
      hardwareMarkers,
      snapSettings,
      showAnnotations,
      tracingOverlays,
      backdrops,
      projectMemo,
      stitchAlwaysShapeIds: stitchAlwaysShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
      stitchThreadColor,
      piecePlacements3d: (piecePlacements3d ?? []).filter((placement) => (patternPieces ?? []).some((piece) => piece.id === placement.pieceId)),
      seamConnections: (seamConnections ?? []).filter(
        (connection) =>
          (patternPieces ?? []).some((piece) => piece.id === connection.from.pieceId) &&
          (patternPieces ?? []).some((piece) => piece.id === connection.to.pieceId),
      ),
      threePreviewSettings,
      avatars,
      threeTextureSource,
      threeTextureShapeIds: threeTextureShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
      leatherImageFills: (leatherImageFills ?? []).map((fill) => ({
        ...fill,
        assignedShapeIds: fill.assignedShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
      })),
      activeLeatherImageFillId,
      showCanvasRuler,
      showDimensions,
      dimensionLines,
      printAreas,
    }),
    [
      activeLayerId,
      activeLineTypeId,
      activeSketchGroupId,
      avatars,
      constraints,
      dimensionLines,
      documentName,
      foldLines,
      hardwareMarkers,
      layers,
      leatherImageFills,
      lineTypes,
      patternPieces,
      pieceGrainlines,
      pieceLabels,
      pieceNotches,
      piecePlacementLabels,
      piecePlacements3d,
      printAreas,
      projectMemo,
      seamAllowances,
      seamConnections,
      shapes,
      showAnnotations,
      showCanvasRuler,
      showDimensions,
      sketchGroups,
      snapSettings,
      stitchAlwaysShapeIds,
      stitchHoles,
      stitchThreadColor,
      threePreviewSettings,
      threeTextureShapeIds,
      threeTextureSource,
      activeLeatherImageFillId,
      tracingOverlays,
      backdrops,
    ],
  )

  const handleEnableStitchOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const selectedIds = Array.from(selectedShapeIdSet)
    setStitchAlwaysShapeIds((previous) => Array.from(new Set([...previous, ...selectedIds])))
    setStatus(`Enabled stitch simulator override for ${selectedIds.length} shape${selectedIds.length === 1 ? '' : 's'}`)
  }

  const handleDisableStitchOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const selectedIds = selectedShapeIdSet
    setStitchAlwaysShapeIds((previous) => previous.filter((shapeId) => !selectedIds.has(shapeId)))
    setStatus('Disabled stitch simulator override on selected shapes')
  }

  const handleUpdateSelectedShapePoint = (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => {
    const targetShapeId = selectedEditableShape?.id
    if (!targetShapeId || !Number.isFinite(value)) {
      return
    }

    setShapes((previous) =>
      previous.map((shape) => {
        if (shape.id !== targetShapeId) {
          return shape
        }

        if ((shape.type === 'line' || shape.type === 'text') && (pointKey === 'start' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        if (shape.type === 'arc' && (pointKey === 'start' || pointKey === 'mid' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        if (shape.type === 'bezier' && (pointKey === 'start' || pointKey === 'control' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        return shape
      }),
    )
  }

  const handleUpdateSelectedStitchHole = (patch: Partial<StitchHole>) => {
    if (!selectedStitchHole) {
      return
    }
    setStitchHoles((previous) =>
      previous.map((entry) =>
        entry.id === selectedStitchHole.id
          ? {
              ...entry,
              ...patch,
              sequence:
                typeof patch.sequence === 'number'
                  ? Math.max(1, Math.round(patch.sequence))
                  : entry.sequence,
              diameterMm:
                typeof patch.diameterMm === 'number'
                  ? Math.max(0, patch.diameterMm)
                  : entry.diameterMm,
              widthMm:
                typeof patch.widthMm === 'number'
                  ? Math.max(0, patch.widthMm)
                  : entry.widthMm,
              heightMm:
                typeof patch.heightMm === 'number'
                  ? Math.max(0, patch.heightMm)
                  : entry.heightMm,
              tiltDeg:
                typeof patch.tiltDeg === 'number'
                  ? Math.max(-89, Math.min(89, patch.tiltDeg))
                  : entry.tiltDeg,
              inverted:
                typeof patch.inverted === 'boolean'
                  ? patch.inverted
                  : entry.inverted,
            }
          : entry,
      ),
    )
  }

  const handleResetExportOptions = () => {
    setExportOnlySelectedShapes(false)
    setExportOnlyVisibleLineTypes(true)
    setExportRoleFilters({ ...DEFAULT_EXPORT_ROLE_FILTERS })
    setExportForceSolidStrokes(false)
    setExportStitchHoleRenderMode('native')
    setExportStitchDotRadiusMm(0.6)
    setDxfFlipY(false)
    setDxfVersion('r12')
  }

  const updateFoldLine = (foldLineId: string, updates: Partial<(typeof foldLines)[number]>) => {
    setFoldLines((previous) =>
      previous.map((foldLine) =>
        foldLine.id === foldLineId
          ? {
              ...foldLine,
              ...updates,
            }
          : foldLine,
      ),
    )
  }

  return {
    buildCurrentDocFile,
    handleEnableStitchOnSelection,
    handleDisableStitchOnSelection,
    handleUpdateSelectedShapePoint,
    handleUpdateSelectedStitchHole,
    handleResetExportOptions,
    updateFoldLine,
  }
}
