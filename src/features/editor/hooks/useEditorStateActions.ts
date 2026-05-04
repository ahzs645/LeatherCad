import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'
import type {
  AvatarSpec,
  Backdrop,
  FoldLine,
  HardwareMarker,
  Layer,
  LeatherImageFill,
  LineType,
  AssemblyConnection,
  PatternPiece,
  PieceInterface,
  PiecePlacement3D,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  ThreePreviewSettings,
  TextureSource,
  TracingOverlay,
} from '../cad/cad-types'
import { DEFAULT_SNAP_SETTINGS, DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import type { EditorSnapshot } from '../editor-types'
import { createDefaultLayer } from '../editor-utils'

type UseEditorStateActionsParams = {
  activeLayer: Layer | null
  activeSketchGroup: SketchGroup | null
  activeLineType: LineType | null
  clearDraft: () => void
  setDocumentName: Dispatch<SetStateAction<string | null>>
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setPatternPieces: Dispatch<SetStateAction<PatternPiece[]>>
  setPieceInterfaces: Dispatch<SetStateAction<PieceInterface[]>>
  setAssemblyConnections: Dispatch<SetStateAction<AssemblyConnection[]>>
  setPieceGrainlines: Dispatch<SetStateAction<PieceGrainline[]>>
  setPieceLabels: Dispatch<SetStateAction<PieceLabel[]>>
  setPiecePlacementLabels: Dispatch<SetStateAction<PiecePlacementLabel[]>>
  setPiecePlacements3d: Dispatch<SetStateAction<PiecePlacement3D[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSnapSettings: Dispatch<SetStateAction<SnapSettings>>
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setBackdrops: Dispatch<SetStateAction<Backdrop[]>>
  setActiveBackdropId: Dispatch<SetStateAction<string | null>>
  setProjectMemo: Dispatch<SetStateAction<string>>
  setStitchAlwaysShapeIds: Dispatch<SetStateAction<string[]>>
  setStitchThreadColor: Dispatch<SetStateAction<string>>
  setThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
  setAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  setThreeTextureSource: Dispatch<SetStateAction<TextureSource | null>>
  setThreeTextureShapeIds: Dispatch<SetStateAction<string[]>>
  setLeatherImageFills: Dispatch<SetStateAction<LeatherImageFill[]>>
  setActiveLeatherImageFillId: Dispatch<SetStateAction<string | null>>
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  setShowDimensions: Dispatch<SetStateAction<boolean>>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  setFrontLayerColor: Dispatch<SetStateAction<string>>
  setBackLayerColor: Dispatch<SetStateAction<string>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useEditorStateActions(params: UseEditorStateActionsParams) {
  const {
    activeLayer,
    activeSketchGroup,
    activeLineType,
    clearDraft,
    setDocumentName,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setShowPrintAreas,
    setStatus,
  } = params

  const applyEditorSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setLayers(snapshot.layers)
    setActiveLayerId(snapshot.activeLayerId)
    setSketchGroups(snapshot.sketchGroups)
    setActiveSketchGroupId(snapshot.activeSketchGroupId)
    setLineTypes(snapshot.lineTypes)
    setActiveLineTypeId(snapshot.activeLineTypeId)
    setShapes(snapshot.shapes)
    setFoldLines(snapshot.foldLines)
    setStitchHoles(snapshot.stitchHoles)
    setConstraints(snapshot.constraints)
    setPatternPieces(snapshot.patternPieces)
    setPieceInterfaces(snapshot.pieceInterfaces)
    setAssemblyConnections(snapshot.assemblyConnections)
    setPieceGrainlines(snapshot.pieceGrainlines)
    setPieceLabels(snapshot.pieceLabels)
    setPiecePlacementLabels(snapshot.piecePlacementLabels)
    setPiecePlacements3d(snapshot.piecePlacements3d)
    setSeamConnections(snapshot.seamConnections)
    setSeamAllowances(snapshot.seamAllowances)
    setPieceNotches(snapshot.pieceNotches)
    setHardwareMarkers(snapshot.hardwareMarkers)
    setSnapSettings(snapshot.snapSettings)
    setShowAnnotations(snapshot.showAnnotations)
    setTracingOverlays(snapshot.tracingOverlays)
    setBackdrops(snapshot.backdrops)
    setActiveBackdropId(null)
    setProjectMemo(snapshot.projectMemo)
    setStitchAlwaysShapeIds(snapshot.stitchAlwaysShapeIds)
    setStitchThreadColor(snapshot.stitchThreadColor)
    setThreePreviewSettings(snapshot.threePreviewSettings)
    setAvatars(snapshot.avatars)
    setThreeTextureSource(snapshot.threeTextureSource)
    setThreeTextureShapeIds(snapshot.threeTextureShapeIds)
    setLeatherImageFills(snapshot.leatherImageFills)
    setActiveLeatherImageFillId(snapshot.activeLeatherImageFillId)
    setShowCanvasRuler(snapshot.showCanvasRuler)
    setShowDimensions(snapshot.showDimensions)
    setLayerColorOverrides(snapshot.layerColorOverrides)
    setFrontLayerColor(snapshot.frontLayerColor)
    setBackLayerColor(snapshot.backLayerColor)
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
  }, [
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
  ])

  const ensureActiveLayerWritable = useCallback(() => {
    if (!activeLayer) {
      setStatus('No active layer available')
      return false
    }

    if (!activeLayer.visible) {
      setStatus('Active layer is hidden. Show it before drawing.')
      return false
    }

    if (activeLayer.locked) {
      setStatus('Active layer is locked. Unlock it before drawing.')
      return false
    }

    if (activeSketchGroup) {
      if (!activeSketchGroup.visible) {
        setStatus('Active sub-sketch is hidden. Show it before drawing.')
        return false
      }
      if (activeSketchGroup.locked) {
        setStatus('Active sub-sketch is locked. Unlock it before drawing.')
        return false
      }
      if (activeSketchGroup.layerId !== activeLayer.id) {
        setStatus('Active sub-sketch belongs to another layer. Switch layer or clear active sub-sketch.')
        return false
      }
    }

    return true
  }, [activeLayer, activeSketchGroup, setStatus])

  const ensureActiveLineTypeWritable = useCallback(() => {
    if (!activeLineType) {
      setStatus('No active line type available')
      return false
    }

    if (!activeLineType.visible) {
      setStatus('Active line type is hidden. Show it before drawing.')
      return false
    }

    return true
  }, [activeLineType, setStatus])

  const resetDocument = useCallback((statusMessage = 'Document cleared and reset to Layer 1') => {
    const baseLayerId = uid()
    const defaultLineTypes = createDefaultLineTypes()
    setDocumentName(null)
    setLayers([createDefaultLayer(baseLayerId)])
    setActiveLayerId(baseLayerId)
    setSketchGroups([])
    setActiveSketchGroupId(null)
    setLineTypes(defaultLineTypes)
    setActiveLineTypeId(DEFAULT_ACTIVE_LINE_TYPE_ID)
    setShapes([])
    setFoldLines([])
    setStitchHoles([])
    setConstraints([])
    setPatternPieces([])
    setPieceInterfaces([])
    setAssemblyConnections([])
    setPieceGrainlines([])
    setPieceLabels([])
    setPiecePlacementLabels([])
    setPiecePlacements3d([])
    setSeamConnections([])
    setSeamAllowances([])
    setPieceNotches([])
    setHardwareMarkers([])
    setSnapSettings(DEFAULT_SNAP_SETTINGS)
    setShowAnnotations(true)
    setTracingOverlays([])
    setBackdrops([])
    setActiveBackdropId(null)
    setProjectMemo('')
    setStitchAlwaysShapeIds([])
    setStitchThreadColor('#fb923c')
    setThreePreviewSettings(DEFAULT_THREE_PREVIEW_SETTINGS)
    setAvatars([])
    setThreeTextureSource(null)
    setThreeTextureShapeIds([])
    setLeatherImageFills([])
    setActiveLeatherImageFillId(null)
    setShowCanvasRuler(true)
    setShowDimensions(false)
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setLayerColorOverrides({})
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }, [
    clearDraft,
    setDocumentName,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setShowPrintAreas,
    setStatus,
  ])

  return {
    applyEditorSnapshot,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
    resetDocument,
  }
}
