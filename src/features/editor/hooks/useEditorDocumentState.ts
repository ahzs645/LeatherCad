import { useState } from 'react'
import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  LineType,
  PatternPiece,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  PrintArea,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TextureSource,
  TracingOverlay,
} from '../cad/cad-types'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'
import { DEFAULT_SNAP_SETTINGS } from '../editor-constants'

export function useEditorDocumentState() {
  const [lineTypes, setLineTypes] = useState<LineType[]>(() => createDefaultLineTypes())
  const [activeLineTypeId, setActiveLineTypeId] = useState(DEFAULT_ACTIVE_LINE_TYPE_ID)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [foldLines, setFoldLines] = useState<FoldLine[]>([])
  const [stitchHoles, setStitchHoles] = useState<StitchHole[]>([])
  const [sketchGroups, setSketchGroups] = useState<SketchGroup[]>([])
  const [activeSketchGroupId, setActiveSketchGroupId] = useState<string | null>(null)
  const [constraints, setConstraints] = useState<ParametricConstraint[]>([])
  const [patternPieces, setPatternPieces] = useState<PatternPiece[]>([])
  const [pieceGrainlines, setPieceGrainlines] = useState<PieceGrainline[]>([])
  const [pieceLabels, setPieceLabels] = useState<PieceLabel[]>([])
  const [piecePlacementLabels, setPiecePlacementLabels] = useState<PiecePlacementLabel[]>([])
  const [seamAllowances, setSeamAllowances] = useState<PieceSeamAllowance[]>([])
  const [pieceNotches, setPieceNotches] = useState<PieceNotch[]>([])
  const [hardwareMarkers, setHardwareMarkers] = useState<HardwareMarker[]>([])
  const [dimensionLines, setDimensionLines] = useState<DimensionLine[]>([])
  const [printAreas, setPrintAreas] = useState<PrintArea[]>([])
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [projectMemo, setProjectMemo] = useState('')
  const [stitchAlwaysShapeIds, setStitchAlwaysShapeIds] = useState<string[]>([])
  const [stitchThreadColor, setStitchThreadColor] = useState('#fb923c')
  const [threeTextureSource, setThreeTextureSource] = useState<TextureSource | null>(null)
  const [threeTextureShapeIds, setThreeTextureShapeIds] = useState<string[]>([])
  const [showCanvasRuler, setShowCanvasRuler] = useState(true)
  const [showDimensions, setShowDimensions] = useState(false)

  return {
    lineTypes, setLineTypes,
    activeLineTypeId, setActiveLineTypeId,
    shapes, setShapes,
    foldLines, setFoldLines,
    stitchHoles, setStitchHoles,
    sketchGroups, setSketchGroups,
    activeSketchGroupId, setActiveSketchGroupId,
    constraints, setConstraints,
    patternPieces, setPatternPieces,
    pieceGrainlines, setPieceGrainlines,
    pieceLabels, setPieceLabels,
    piecePlacementLabels, setPiecePlacementLabels,
    seamAllowances, setSeamAllowances,
    pieceNotches, setPieceNotches,
    hardwareMarkers, setHardwareMarkers,
    dimensionLines, setDimensionLines,
    printAreas, setPrintAreas,
    snapSettings, setSnapSettings,
    showAnnotations, setShowAnnotations,
    tracingOverlays, setTracingOverlays,
    activeTracingOverlayId, setActiveTracingOverlayId,
    projectMemo, setProjectMemo,
    stitchAlwaysShapeIds, setStitchAlwaysShapeIds,
    stitchThreadColor, setStitchThreadColor,
    threeTextureSource, setThreeTextureSource,
    threeTextureShapeIds, setThreeTextureShapeIds,
    showCanvasRuler, setShowCanvasRuler,
    showDimensions, setShowDimensions,
  }
}
