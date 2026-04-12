import { useCallback, useMemo } from 'react'
import type { DocFile, FoldLine, LineType, PatternPiece } from '../../cad/cad-types'
import { buildAnnotationExportShapes } from '../../ops/annotation-export-shapes'
import { openPrintTilesWindow } from '../../preview/print-output'
import { buildPrintPlan } from '../../preview/print-preview'
import { useEditorPanelSelector } from '../providers/EditorPanelStateProvider'
import { useEditorUIActions } from '../providers/EditorUIStateProvider'

type UsePrintPreviewStateParams = {
  lineTypes: LineType[]
  activeLineTypeId: string
  activeLayerId: string
  showAnnotations: boolean
  selectedShapeIdSet: Set<string>
  patternPiecesById: Record<string, PatternPiece | undefined>
  annotationLabels: import('../../editor-types').AnnotationLabel[]
  pieceGrainlineSegments: Array<{ pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point }>
  pieceNotchLines: Array<{ id: string; pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point; showOnSeam: boolean }>
  piecePlacementGuides: import('../../editor-types').PiecePlacementGuide[]
  printableShapes: DocFile['objects']
  foldLines: FoldLine[]
  lineTypesById: Record<string, LineType | undefined>
}

export function usePrintPreviewState({
  lineTypes,
  activeLineTypeId,
  activeLayerId,
  showAnnotations,
  selectedShapeIdSet,
  patternPiecesById,
  annotationLabels,
  pieceGrainlineSegments,
  pieceNotchLines,
  piecePlacementGuides,
  printableShapes,
  foldLines,
  lineTypesById,
}: UsePrintPreviewStateParams) {
  const {
    printSelectedOnly,
    printPaper,
    printMarginMm,
    printOverlapMm,
    printTileX,
    printTileY,
    printScalePercent,
    printInColor,
    printStitchAsDots,
    printRulerInside,
    printCalibrationXPercent,
    printCalibrationYPercent,
  } = useEditorPanelSelector((state) => ({
    printSelectedOnly: state.printSelectedOnly,
    printPaper: state.printPaper,
    printMarginMm: state.printMarginMm,
    printOverlapMm: state.printOverlapMm,
    printTileX: state.printTileX,
    printTileY: state.printTileY,
    printScalePercent: state.printScalePercent,
    printInColor: state.printInColor,
    printStitchAsDots: state.printStitchAsDots,
    printRulerInside: state.printRulerInside,
    printCalibrationXPercent: state.printCalibrationXPercent,
    printCalibrationYPercent: state.printCalibrationYPercent,
  }))
  const { setStatus } = useEditorUIActions()
  const annotationLineTypeId = useMemo(
    () => lineTypes.find((lineType) => lineType.role === 'mark')?.id ?? lineTypes[0]?.id ?? activeLineTypeId,
    [lineTypes, activeLineTypeId],
  )

  const printableAnnotationShapes = useMemo(
    () =>
      buildAnnotationExportShapes({
        showAnnotations,
        onlySelected: printSelectedOnly,
        selectedShapeIdSet,
        patternPiecesById,
        annotationLabels,
        pieceGrainlineSegments,
        pieceNotchLines,
        piecePlacementGuides,
        fallbackLayerId: activeLayerId,
        annotationLineTypeId,
      }),
    [
      showAnnotations,
      printSelectedOnly,
      selectedShapeIdSet,
      patternPiecesById,
      annotationLabels,
      pieceGrainlineSegments,
      pieceNotchLines,
      piecePlacementGuides,
      activeLayerId,
      annotationLineTypeId,
    ],
  )

  const printOutputShapes = useMemo(
    () => [...printableShapes, ...printableAnnotationShapes],
    [printableShapes, printableAnnotationShapes],
  )

  const printOutputPlan = useMemo(
    () =>
      buildPrintPlan(printOutputShapes, {
        paper: printPaper,
        marginMm: printMarginMm,
        overlapMm: printOverlapMm,
        tileX: printTileX,
        tileY: printTileY,
        scalePercent: printScalePercent,
      }),
    [printOutputShapes, printPaper, printMarginMm, printOverlapMm, printTileX, printTileY, printScalePercent],
  )

  const printableLineTypesById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(lineTypesById).filter((entry): entry is [string, LineType] => entry[1] !== undefined),
      ),
    [lineTypesById],
  )

  const handleOpenPrintTiles = useCallback(() => {
    if (!printOutputPlan || printOutputShapes.length === 0) {
      setStatus('No printable content available')
      return
    }

    const opened = openPrintTilesWindow({
      shapes: printOutputShapes,
      foldLines,
      lineTypesById: printableLineTypesById,
      printPlan: printOutputPlan,
      printInColor,
      printStitchAsDots,
      printRulerInside,
      calibrationXPercent: printCalibrationXPercent,
      calibrationYPercent: printCalibrationYPercent,
    })

    if (!opened) {
      setStatus('Could not open print window (popup may be blocked)')
      return
    }

    setStatus(`Opened printable tiles (${printOutputPlan.tiles.length} page${printOutputPlan.tiles.length === 1 ? '' : 's'})`)
  }, [
    foldLines,
    printableLineTypesById,
    printCalibrationXPercent,
    printCalibrationYPercent,
    printInColor,
    printOutputPlan,
    printOutputShapes,
    printRulerInside,
    printStitchAsDots,
    setStatus,
  ])

  return {
    annotationLineTypeId,
    printableAnnotationShapes,
    printOutputShapes,
    printOutputPlan,
    handleOpenPrintTiles,
  }
}
