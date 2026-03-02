import { useState } from 'react'
import type { ConstraintAxis, ConstraintEdge, HardwareKind } from '../cad/cad-types'
import { DEFAULT_EXPORT_ROLE_FILTERS, DEFAULT_SEAM_ALLOWANCE_MM } from '../editor-constants'
import type { DxfVersion, ExportRoleFilters } from '../editor-types'
import type { PrintPaper } from '../preview/print-preview'

export function useEditorPanelState() {
  const [showLayerColorModal, setShowLayerColorModal] = useState(false)
  const [showLineTypePalette, setShowLineTypePalette] = useState(false)
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false)
  const [exportOnlySelectedShapes, setExportOnlySelectedShapes] = useState(false)
  const [exportOnlyVisibleLineTypes, setExportOnlyVisibleLineTypes] = useState(true)
  const [exportRoleFilters, setExportRoleFilters] = useState<ExportRoleFilters>({ ...DEFAULT_EXPORT_ROLE_FILTERS })
  const [exportForceSolidStrokes, setExportForceSolidStrokes] = useState(false)
  const [dxfFlipY, setDxfFlipY] = useState(false)
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('r12')
  const [showTracingModal, setShowTracingModal] = useState(false)
  const [showPatternToolsModal, setShowPatternToolsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showTemplateRepositoryModal, setShowTemplateRepositoryModal] = useState(false)
  const [printPaper, setPrintPaper] = useState<PrintPaper>('letter')
  const [printTileX, setPrintTileX] = useState(1)
  const [printTileY, setPrintTileY] = useState(1)
  const [printOverlapMm, setPrintOverlapMm] = useState(4)
  const [printMarginMm, setPrintMarginMm] = useState(8)
  const [printScalePercent, setPrintScalePercent] = useState(100)
  const [printSelectedOnly, setPrintSelectedOnly] = useState(false)
  const [printRulerInside, setPrintRulerInside] = useState(false)
  const [printInColor, setPrintInColor] = useState(true)
  const [printStitchAsDots, setPrintStitchAsDots] = useState(false)
  const [showPrintAreas, setShowPrintAreas] = useState(false)
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false)
  const [seamAllowanceInputMm, setSeamAllowanceInputMm] = useState(DEFAULT_SEAM_ALLOWANCE_MM)
  const [constraintEdge, setConstraintEdge] = useState<ConstraintEdge>('left')
  const [constraintOffsetMm, setConstraintOffsetMm] = useState(10)
  const [constraintAxis, setConstraintAxis] = useState<ConstraintAxis>('x')
  const [hardwarePreset, setHardwarePreset] = useState<HardwareKind>('snap')
  const [customHardwareDiameterMm, setCustomHardwareDiameterMm] = useState(4)
  const [customHardwareSpacingMm, setCustomHardwareSpacingMm] = useState(0)

  return {
    showLayerColorModal,
    setShowLayerColorModal,
    showLineTypePalette,
    setShowLineTypePalette,
    showExportOptionsModal,
    setShowExportOptionsModal,
    exportOnlySelectedShapes,
    setExportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    setExportOnlyVisibleLineTypes,
    exportRoleFilters,
    setExportRoleFilters,
    exportForceSolidStrokes,
    setExportForceSolidStrokes,
    dxfFlipY,
    setDxfFlipY,
    dxfVersion,
    setDxfVersion,
    showTracingModal,
    setShowTracingModal,
    showPatternToolsModal,
    setShowPatternToolsModal,
    showHelpModal,
    setShowHelpModal,
    showTemplateRepositoryModal,
    setShowTemplateRepositoryModal,
    printPaper,
    setPrintPaper,
    printTileX,
    setPrintTileX,
    printTileY,
    setPrintTileY,
    printOverlapMm,
    setPrintOverlapMm,
    printMarginMm,
    setPrintMarginMm,
    printScalePercent,
    setPrintScalePercent,
    printSelectedOnly,
    setPrintSelectedOnly,
    printRulerInside,
    setPrintRulerInside,
    printInColor,
    setPrintInColor,
    printStitchAsDots,
    setPrintStitchAsDots,
    showPrintAreas,
    setShowPrintAreas,
    showPrintPreviewModal,
    setShowPrintPreviewModal,
    seamAllowanceInputMm,
    setSeamAllowanceInputMm,
    constraintEdge,
    setConstraintEdge,
    constraintOffsetMm,
    setConstraintOffsetMm,
    constraintAxis,
    setConstraintAxis,
    hardwarePreset,
    setHardwarePreset,
    customHardwareDiameterMm,
    setCustomHardwareDiameterMm,
    customHardwareSpacingMm,
    setCustomHardwareSpacingMm,
  }
}
