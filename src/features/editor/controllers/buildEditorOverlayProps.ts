import type {
  ChangeEvent,
  ChangeEventHandler,
  ComponentProps,
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  ArcShape,
  LineShape,
  PatternPiece,
  PieceGrainline,
  Shape,
  StitchHole,
  TextShape,
} from '../cad/cad-types'
import { EditorModalStack } from '../components/EditorModalStack'
import type { EditorHiddenInputsProps } from '../components/EditorHiddenInputs'
import type { LengthAdjustMode } from '../components/LengthAdjustModal'
import type { NestingModalProps } from '../components/NestingModal'
import type { PieceInspectorContentProps } from '../components/PieceInspectorContent'
import type { PieceInspectorModalProps } from '../components/PieceInspectorModal'
import type { ProjectMemoModalProps } from '../components/ProjectMemoModal'
import { saveAutoSaveEnabled } from '../ops/autosave'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import { saveEditorPreferences, getDefaultEditorPreferences } from '../ops/editor-prefs'
import { addFontToList, removeFontFromList, saveFontList } from '../ops/font-list-ops'
import {
  getArcGeometry,
  getLineAngleDeg,
  getLineLengthMm,
  scaleLineLengthByRatio,
  setArcGeometry,
  setLineAngle,
  setLineLength,
} from '../ops/geometry-editing-ops'
import type { OutlineChain } from '../ops/outline-detection'
import { getTerminalStitchHoleIdForShape } from '../ops/stitch-hole-ops'
import type { StitchSimulatorResult, StitchSimulatorSettings } from '../ops/stitch-simulator-ops'
import { saveStitchSimulatorSettings } from '../ops/stitch-simulator-settings'
import { parseTranslationFile, saveTranslationMap } from '../ops/translation-ops'

type ModalStackProps = ComponentProps<typeof EditorModalStack>
type BoxStitchModalProps = NonNullable<ModalStackProps['boxStitchModalProps']>
type BoxStitchHelperModalProps = NonNullable<ModalStackProps['boxStitchHelperModalProps']>
type MandalaModalProps = NonNullable<ModalStackProps['mandalaModalProps']>
type WizardModalProps = NonNullable<ModalStackProps['wizardModalProps']>
type BackdropModalProps = NonNullable<ModalStackProps['backdropModalProps']>
type LetterStampModalProps = NonNullable<ModalStackProps['letterStampModalProps']>
type MoveCopyDistanceModalProps = NonNullable<ModalStackProps['moveCopyDistanceModalProps']>
type SvgImportOptionsModalProps = NonNullable<ModalStackProps['svgImportOptionsModalProps']>
type SpecifyScaleModalProps = NonNullable<ModalStackProps['specifyScaleModalProps']>
type FontListModalProps = NonNullable<ModalStackProps['fontListModalProps']>
type OptionsModalProps = NonNullable<ModalStackProps['optionsModalProps']>

export type EditorOverlayProps = {
  modalStackProps: ModalStackProps
  projectMemoModalProps: ProjectMemoModalProps
  pieceInspectorModalProps: PieceInspectorModalProps | null
  nestingModalProps: NestingModalProps
  hiddenInputsProps: EditorHiddenInputsProps
  fontInputRef: RefObject<HTMLInputElement | null>
  onFontInputChange: ChangeEventHandler<HTMLInputElement>
}

export type BuildEditorOverlayPropsParams = {
  modalStackProps: ModalStackProps
  showStitchSimulatorModal: boolean
  setShowStitchSimulatorModal: Dispatch<SetStateAction<boolean>>
  stitchSimulatorSettings: StitchSimulatorSettings
  setStitchSimulatorSettings: Dispatch<SetStateAction<StitchSimulatorSettings>>
  stitchSimulatorResult: StitchSimulatorResult | null
  stitchHoles: StitchHole[]
  selectedStitchHole: StitchHole | null
  showBoxStitchHelperModal: boolean
  setShowBoxStitchHelperModal: Dispatch<SetStateAction<boolean>>
  boxStitchHelperSettings: BoxStitchHelperSettings
  handleApplyBoxStitchHelper: BoxStitchHelperModalProps['onApply']
  selectedShapeCount: number
  showBoxStitchModal: boolean
  setShowBoxStitchModal: Dispatch<SetStateAction<boolean>>
  handleGenerateBoxStitch: BoxStitchModalProps['onGenerate']
  activeLayerId: string
  activeLineTypeId: string
  showMandalaModal: boolean
  setShowMandalaModal: Dispatch<SetStateAction<boolean>>
  handleGenerateMandalaRadial: MandalaModalProps['onGenerateRadial']
  handleGenerateSpiral: MandalaModalProps['onGenerateSpiral']
  handleGenerateGoldenGuides: MandalaModalProps['onGenerateGoldenGuides']
  handleGenerateWhiteSilverGuides: MandalaModalProps['onGenerateWhiteSilverGuides']
  showWizardModal: boolean
  setShowWizardModal: Dispatch<SetStateAction<boolean>>
  handleGenerateWizardPattern: WizardModalProps['onGenerate']
  showBackdropModal: boolean
  setShowBackdropModal: Dispatch<SetStateAction<boolean>>
  backdrops: BackdropModalProps['backdrops']
  activeBackdrop: BackdropModalProps['activeBackdrop']
  onSelectBackdrop: BackdropModalProps['onSelectBackdrop']
  onImportBackdrop: BackdropModalProps['onImportBackdrop']
  onDeleteActiveBackdrop: BackdropModalProps['onDeleteActiveBackdrop']
  onUpdateBackdrop: BackdropModalProps['onUpdateBackdrop']
  onBackdropUndo: BackdropModalProps['onBackdropUndo']
  onBackdropRedo: BackdropModalProps['onBackdropRedo']
  backdropFileInputRef: BackdropModalProps['fileInputRef']
  onBackdropFileChange: BackdropModalProps['onFileChange']
  showLetterStampModal: boolean
  setShowLetterStampModal: Dispatch<SetStateAction<boolean>>
  handleGenerateLetterStamp: LetterStampModalProps['onGenerate']
  showChangeShapeSizeModal: boolean
  setShowChangeShapeSizeModal: Dispatch<SetStateAction<boolean>>
  handleResizeShapes: (width: number, height: number, lockAspect: boolean) => void
  selectionBounds: { width: number; height: number } | null
  showMoveCopyDistanceModal: boolean
  setShowMoveCopyDistanceModal: Dispatch<SetStateAction<boolean>>
  moveCopyDistanceMode: MoveCopyDistanceModalProps['mode']
  handleMoveSelectionByDistance: (dx?: number, dy?: number) => void
  handleCopySelectionByDistance: (dx?: number, dy?: number) => void
  showSpecifyRotationModal: boolean
  setShowSpecifyRotationModal: Dispatch<SetStateAction<boolean>>
  handleSpecifyRotation: (angleDeg: number) => void
  showSpecifyScaleModal: boolean
  setShowSpecifyScaleModal: Dispatch<SetStateAction<boolean>>
  specifyScaleModalAxis: SpecifyScaleModalProps['axis']
  handleSpecifyScale: (factorX: number, factorY: number) => void
  showFontListModal: boolean
  setShowFontListModal: Dispatch<SetStateAction<boolean>>
  fontList: FontListModalProps['fonts']
  setFontList: Dispatch<SetStateAction<FontListModalProps['fonts']>>
  setTextFontFamily: Dispatch<SetStateAction<string>>
  showOptionsModal: boolean
  setShowOptionsModal: Dispatch<SetStateAction<boolean>>
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  setAutoSaveEnabled: Dispatch<SetStateAction<boolean>>
  setReverseZoomDirection: Dispatch<SetStateAction<boolean>>
  setIncrementalSelection: Dispatch<SetStateAction<boolean>>
  setMentoriWithoutCtrl: Dispatch<SetStateAction<boolean>>
  setExportIncludeText: Dispatch<SetStateAction<boolean>>
  setExportIncludeTemplateMetadata: Dispatch<SetStateAction<boolean>>
  leatherSimTextureRotationDeg: number
  lineToolConstraint: OptionsModalProps['lineToolConstraint']
  setLineToolConstraint: Dispatch<SetStateAction<OptionsModalProps['lineToolConstraint']>>
  gridBackgroundMode: OptionsModalProps['gridBackgroundMode']
  setGridBackgroundMode: Dispatch<SetStateAction<OptionsModalProps['gridBackgroundMode']>>
  showLengthAdjustModal: boolean
  setShowLengthAdjustModal: Dispatch<SetStateAction<boolean>>
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  showProjectMemoModal: boolean
  setShowProjectMemoModal: Dispatch<SetStateAction<boolean>>
  projectMemo: string
  setProjectMemo: Dispatch<SetStateAction<string>>
  isMobileLayout: boolean
  showPieceInspectorModal: boolean
  setShowPieceInspectorModal: Dispatch<SetStateAction<boolean>>
  pieceInspectorContentProps: PieceInspectorContentProps
  showNestingModal: boolean
  setShowNestingModal: Dispatch<SetStateAction<boolean>>
  patternPieces: PatternPiece[]
  pieceGrainlines: PieceGrainline[]
  patternPieceChainsByShapeId: Map<string, OutlineChain>
  fileInputRef: RefObject<HTMLInputElement | null>
  svgInputRef: RefObject<HTMLInputElement | null>
  tracingInputRef: RefObject<HTMLInputElement | null>
  svgImportOptionsModalProps: SvgImportOptionsModalProps
  templateImportInputRef: RefObject<HTMLInputElement | null>
  catalogImportInputRef: RefObject<HTMLInputElement | null>
  translationInputRef: RefObject<HTMLInputElement | null>
  handleLoadJson: ChangeEventHandler<HTMLInputElement>
  handleImportSvg: ChangeEventHandler<HTMLInputElement>
  handleImportTracing: ChangeEventHandler<HTMLInputElement>
  handleImportTemplateRepositoryFile: ChangeEventHandler<HTMLInputElement>
  handleImportCatalogFile: ChangeEventHandler<HTMLInputElement>
  setTranslationMap: Dispatch<SetStateAction<Record<string, string>>>
  fontInputRef: RefObject<HTMLInputElement | null>
  onFontInputChange: ChangeEventHandler<HTMLInputElement>
  setStatus: Dispatch<SetStateAction<string>>
}

export function buildEditorOverlayProps({
  modalStackProps,
  showStitchSimulatorModal,
  setShowStitchSimulatorModal,
  stitchSimulatorSettings,
  setStitchSimulatorSettings,
  stitchSimulatorResult,
  stitchHoles,
  selectedStitchHole,
  showBoxStitchHelperModal,
  setShowBoxStitchHelperModal,
  boxStitchHelperSettings,
  handleApplyBoxStitchHelper,
  selectedShapeCount,
  showBoxStitchModal,
  setShowBoxStitchModal,
  handleGenerateBoxStitch,
  activeLayerId,
  activeLineTypeId,
  showMandalaModal,
  setShowMandalaModal,
  handleGenerateMandalaRadial,
  handleGenerateSpiral,
  handleGenerateGoldenGuides,
  handleGenerateWhiteSilverGuides,
  showWizardModal,
  setShowWizardModal,
  handleGenerateWizardPattern,
  showBackdropModal,
  setShowBackdropModal,
  backdrops,
  activeBackdrop,
  onSelectBackdrop,
  onImportBackdrop,
  onDeleteActiveBackdrop,
  onUpdateBackdrop,
  onBackdropUndo,
  onBackdropRedo,
  backdropFileInputRef,
  onBackdropFileChange,
  showLetterStampModal,
  setShowLetterStampModal,
  handleGenerateLetterStamp,
  showChangeShapeSizeModal,
  setShowChangeShapeSizeModal,
  handleResizeShapes,
  selectionBounds,
  showMoveCopyDistanceModal,
  setShowMoveCopyDistanceModal,
  moveCopyDistanceMode,
  handleMoveSelectionByDistance,
  handleCopySelectionByDistance,
  showSpecifyRotationModal,
  setShowSpecifyRotationModal,
  handleSpecifyRotation,
  showSpecifyScaleModal,
  setShowSpecifyScaleModal,
  specifyScaleModalAxis,
  handleSpecifyScale,
  showFontListModal,
  setShowFontListModal,
  fontList,
  setFontList,
  setTextFontFamily,
  showOptionsModal,
  setShowOptionsModal,
  autoSaveEnabled,
  reverseZoomDirection,
  incrementalSelection,
  mentoriWithoutCtrl,
  exportIncludeText,
  exportIncludeTemplateMetadata,
  setAutoSaveEnabled,
  setReverseZoomDirection,
  setIncrementalSelection,
  setMentoriWithoutCtrl,
  setExportIncludeText,
  setExportIncludeTemplateMetadata,
  leatherSimTextureRotationDeg,
  lineToolConstraint,
  setLineToolConstraint,
  gridBackgroundMode,
  setGridBackgroundMode,
  showLengthAdjustModal,
  setShowLengthAdjustModal,
  shapes,
  selectedShapeIdSet,
  setShapes,
  showProjectMemoModal,
  setShowProjectMemoModal,
  projectMemo,
  setProjectMemo,
  isMobileLayout,
  showPieceInspectorModal,
  setShowPieceInspectorModal,
  pieceInspectorContentProps,
  showNestingModal,
  setShowNestingModal,
  patternPieces,
  pieceGrainlines,
  patternPieceChainsByShapeId,
  fileInputRef,
  svgInputRef,
  tracingInputRef,
  svgImportOptionsModalProps,
  templateImportInputRef,
  catalogImportInputRef,
  translationInputRef,
  handleLoadJson,
  handleImportSvg,
  handleImportTracing,
  handleImportTemplateRepositoryFile,
  handleImportCatalogFile,
  setTranslationMap,
  fontInputRef,
  onFontInputChange,
  setStatus,
}: BuildEditorOverlayPropsParams): EditorOverlayProps {
  return {
    modalStackProps: {
      ...modalStackProps,
      stitchSimulatorModalProps: {
        open: showStitchSimulatorModal,
        onClose: () => setShowStitchSimulatorModal(false),
        settings: stitchSimulatorSettings,
        onApply: (settings: StitchSimulatorSettings) => {
          setStitchSimulatorSettings(settings)
          saveStitchSimulatorSettings(settings)
          setStatus('Stitch simulator settings updated')
        },
        stitchHoleCount: stitchHoles.length,
        threadLength: stitchSimulatorResult?.threadLength ?? null,
        selectedHoleLabel: selectedStitchHole ? `Hole ${selectedStitchHole.sequence + 1}` : null,
        terminalHoleLabel:
          (selectedStitchHole
            ? getTerminalStitchHoleIdForShape(stitchHoles, selectedStitchHole.shapeId)
            : stitchSimulatorResult?.terminalHoleId)
            ? `Hole ${
                (
                  stitchHoles.find(
                    (hole) =>
                      hole.id ===
                      (selectedStitchHole
                        ? getTerminalStitchHoleIdForShape(stitchHoles, selectedStitchHole.shapeId)
                        : stitchSimulatorResult?.terminalHoleId),
                  )?.sequence ?? 0
                ) + 1
              }`
            : null,
      },
      boxStitchHelperModalProps: {
        open: showBoxStitchHelperModal,
        onClose: () => setShowBoxStitchHelperModal(false),
        onApply: handleApplyBoxStitchHelper,
        settings: boxStitchHelperSettings,
        selectedShapeCount,
      },
      boxStitchModalProps: {
        open: showBoxStitchModal,
        onClose: () => setShowBoxStitchModal(false),
        onGenerate: handleGenerateBoxStitch,
        defaultLayerId: activeLayerId,
        defaultLineTypeId: activeLineTypeId,
      },
      mandalaModalProps: {
        open: showMandalaModal,
        onClose: () => setShowMandalaModal(false),
        onGenerateRadial: handleGenerateMandalaRadial,
        onGenerateSpiral: handleGenerateSpiral,
        onGenerateGoldenGuides: handleGenerateGoldenGuides,
        onGenerateWhiteSilverGuides: handleGenerateWhiteSilverGuides,
        defaultLayerId: activeLayerId,
        defaultLineTypeId: activeLineTypeId,
      },
      wizardModalProps: {
        open: showWizardModal,
        onClose: () => setShowWizardModal(false),
        onGenerate: handleGenerateWizardPattern,
        defaultLayerId: activeLayerId,
        defaultLineTypeId: activeLineTypeId,
      },
      backdropModalProps: {
        open: showBackdropModal,
        onClose: () => setShowBackdropModal(false),
        backdrops,
        activeBackdrop,
        onSelectBackdrop,
        onImportBackdrop,
        onDeleteActiveBackdrop,
        onUpdateBackdrop,
        onBackdropUndo,
        onBackdropRedo,
        fileInputRef: backdropFileInputRef,
        onFileChange: onBackdropFileChange,
      },
      letterStampModalProps: {
        open: showLetterStampModal,
        onClose: () => setShowLetterStampModal(false),
        onGenerate: handleGenerateLetterStamp,
        defaultLayerId: activeLayerId,
        defaultLineTypeId: activeLineTypeId,
      },
      changeShapeSizeModalProps: {
        open: showChangeShapeSizeModal,
        onClose: () => setShowChangeShapeSizeModal(false),
        onApply: (width: number, height: number, lockAspect: boolean) => {
          handleResizeShapes(width, height, lockAspect)
          setShowChangeShapeSizeModal(false)
        },
        currentWidth: selectionBounds?.width ?? 0,
        currentHeight: selectionBounds?.height ?? 0,
        selectedLineLengthMm: (() => {
          const lines = shapes.filter(
            (shape): shape is LineShape => shape.type === 'line' && selectedShapeIdSet.has(shape.id),
          )
          return lines.length === 1 ? getLineLengthMm(lines[0]) : null
        })(),
        selectedLineAngleDeg: (() => {
          const lines = shapes.filter(
            (shape): shape is LineShape => shape.type === 'line' && selectedShapeIdSet.has(shape.id),
          )
          return lines.length === 1 ? getLineAngleDeg(lines[0]) : null
        })(),
        selectedArcRadiusMm: (() => {
          const arcs = shapes.filter(
            (shape): shape is ArcShape => shape.type === 'arc' && selectedShapeIdSet.has(shape.id),
          )
          if (arcs.length !== 1) return null
          return getArcGeometry(arcs[0])?.radiusMm ?? null
        })(),
        selectedArcSweepDeg: (() => {
          const arcs = shapes.filter(
            (shape): shape is ArcShape => shape.type === 'arc' && selectedShapeIdSet.has(shape.id),
          )
          if (arcs.length !== 1) return null
          return getArcGeometry(arcs[0])?.sweepDeg ?? null
        })(),
        selectedTextRadiusMm: (() => {
          const textShapes = shapes.filter(
            (shape): shape is TextShape => shape.type === 'text' && selectedShapeIdSet.has(shape.id),
          )
          return textShapes.length === 1 ? textShapes[0].radiusMm : null
        })(),
        selectedTextSweepDeg: (() => {
          const textShapes = shapes.filter(
            (shape): shape is TextShape => shape.type === 'text' && selectedShapeIdSet.has(shape.id),
          )
          return textShapes.length === 1 ? textShapes[0].sweepDeg : null
        })(),
        onApplyLineGeometry: (lengthMm, angleDeg) => {
          const lines = shapes.filter(
            (shape): shape is LineShape => shape.type === 'line' && selectedShapeIdSet.has(shape.id),
          )
          if (lines.length !== 1) {
            setStatus('Select exactly one line to edit line geometry')
            return
          }
          const targetId = lines[0].id
          setShapes((previous) =>
            previous.map((shape) =>
              shape.id === targetId && shape.type === 'line'
                ? setLineAngle(setLineLength(shape, lengthMm), angleDeg)
                : shape,
            ),
          )
          setShowChangeShapeSizeModal(false)
          setStatus(`Updated line to ${lengthMm.toFixed(2)}mm at ${angleDeg.toFixed(1)} deg`)
        },
        onApplyArcGeometry: (radiusMm, sweepDeg) => {
          const arcs = shapes.filter(
            (shape): shape is ArcShape => shape.type === 'arc' && selectedShapeIdSet.has(shape.id),
          )
          if (arcs.length !== 1) {
            setStatus('Select exactly one arc to edit arc geometry')
            return
          }
          const nextArc = setArcGeometry(arcs[0], radiusMm, sweepDeg)
          if (!nextArc) {
            setStatus('Selected arc cannot be edited with radius/angle controls')
            return
          }
          const targetId = arcs[0].id
          setShapes((previous) =>
            previous.map((shape) =>
              shape.id === targetId && shape.type === 'arc'
                ? setArcGeometry(shape, radiusMm, sweepDeg) ?? shape
                : shape,
            ),
          )
          setShowChangeShapeSizeModal(false)
          setStatus(`Updated arc to ${radiusMm.toFixed(2)}mm radius at ${Math.abs(sweepDeg).toFixed(1)} deg`)
        },
        onApplyTextGeometry: (radiusMm, sweepDeg) => {
          const textShapes = shapes.filter(
            (shape): shape is TextShape => shape.type === 'text' && selectedShapeIdSet.has(shape.id),
          )
          if (textShapes.length !== 1) {
            setStatus('Select exactly one text shape to edit text curve')
            return
          }
          if (!Number.isFinite(radiusMm) || radiusMm <= 0 || !Number.isFinite(sweepDeg)) {
            setStatus('Text curve values must be valid')
            return
          }
          const targetId = textShapes[0].id
          const safeSweepDeg = Math.min(1080, Math.max(-1080, sweepDeg))
          setShapes((previous) =>
            previous.map((shape) =>
              shape.id === targetId && shape.type === 'text'
                ? { ...shape, radiusMm: Math.max(0.1, radiusMm), sweepDeg: safeSweepDeg }
                : shape,
            ),
          )
          setShowChangeShapeSizeModal(false)
          setStatus(`Updated text curve to ${radiusMm.toFixed(2)}mm radius`)
        },
      },
      moveCopyDistanceModalProps: {
        open: showMoveCopyDistanceModal,
        mode: moveCopyDistanceMode,
        selectedShapeCount: selectedShapeIdSet.size,
        onClose: () => setShowMoveCopyDistanceModal(false),
        onApply: (dx, dy, mode) => {
          if (mode === 'copy') {
            handleCopySelectionByDistance(dx, dy)
          } else {
            handleMoveSelectionByDistance(dx, dy)
          }
          setShowMoveCopyDistanceModal(false)
        },
      },
      specifyRotationModalProps: {
        open: showSpecifyRotationModal,
        onClose: () => setShowSpecifyRotationModal(false),
        onApply: (angleDeg: number) => {
          handleSpecifyRotation(angleDeg)
          setShowSpecifyRotationModal(false)
        },
      },
      specifyScaleModalProps: {
        open: showSpecifyScaleModal,
        axis: specifyScaleModalAxis,
        onClose: () => setShowSpecifyScaleModal(false),
        onApply: (factorX: number, factorY: number) => {
          handleSpecifyScale(factorX, factorY)
          setShowSpecifyScaleModal(false)
        },
      },
      fontListModalProps: {
        open: showFontListModal,
        fonts: fontList,
        onClose: () => setShowFontListModal(false),
        onAdd: (fontFamily: string) => {
          const next = addFontToList(fontList, fontFamily)
          setFontList(next)
          saveFontList(next)
        },
        onRemove: (fontFamily: string) => {
          const next = removeFontFromList(fontList, fontFamily)
          setFontList(next)
          saveFontList(next)
        },
        onSelect: (fontFamily: string) => {
          setTextFontFamily(fontFamily)
          setStatus(`Text font family set to ${fontFamily}`)
        },
      },
      optionsModalProps: {
        open: showOptionsModal,
        autoSaveEnabled,
        reverseZoomDirection,
        incrementalSelection,
        mentoriWithoutCtrl,
        exportIncludeText,
        exportIncludeTemplateMetadata,
        onClose: () => setShowOptionsModal(false),
        onChangeAutoSaveEnabled: (value: boolean) => {
          setAutoSaveEnabled(value)
          saveAutoSaveEnabled(value)
        },
        onChangeReverseZoomDirection: (value: boolean) => {
          setReverseZoomDirection(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection: value,
            incrementalSelection,
            mentoriWithoutCtrl,
            exportIncludeText,
            exportIncludeTemplateMetadata,
            leatherSimTextureRotationDeg,
          })
        },
        onChangeIncrementalSelection: (value: boolean) => {
          setIncrementalSelection(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection,
            incrementalSelection: value,
            mentoriWithoutCtrl,
            exportIncludeText,
            exportIncludeTemplateMetadata,
            leatherSimTextureRotationDeg,
          })
        },
        onChangeMentoriWithoutCtrl: (value: boolean) => {
          setMentoriWithoutCtrl(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection,
            incrementalSelection,
            mentoriWithoutCtrl: value,
            exportIncludeText,
            exportIncludeTemplateMetadata,
            leatherSimTextureRotationDeg,
          })
        },
        onChangeExportIncludeText: (value: boolean) => {
          setExportIncludeText(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection,
            incrementalSelection,
            mentoriWithoutCtrl,
            exportIncludeText: value,
            exportIncludeTemplateMetadata,
            leatherSimTextureRotationDeg,
          })
        },
        onChangeExportIncludeTemplateMetadata: (value: boolean) => {
          setExportIncludeTemplateMetadata(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection,
            incrementalSelection,
            mentoriWithoutCtrl,
            exportIncludeText,
            exportIncludeTemplateMetadata: value,
            leatherSimTextureRotationDeg,
            lineToolConstraint,
          })
        },
        lineToolConstraint,
        gridBackgroundMode,
        onChangeGridBackgroundMode: (value: OptionsModalProps['gridBackgroundMode']) => setGridBackgroundMode(value),
        onChangeLineToolConstraint: (value: OptionsModalProps['lineToolConstraint']) => {
          setLineToolConstraint(value)
          saveEditorPreferences({
            ...getDefaultEditorPreferences(),
            reverseZoomDirection,
            incrementalSelection,
            mentoriWithoutCtrl,
            exportIncludeText,
            exportIncludeTemplateMetadata,
            leatherSimTextureRotationDeg,
            lineToolConstraint: value,
          })
        },
      },
      lengthAdjustModalProps: {
        open: showLengthAdjustModal,
        currentLengthMm: (() => {
          const line = shapes.find(
            (shape): shape is LineShape => shape.type === 'line' && selectedShapeIdSet.has(shape.id),
          )
          return line ? getLineLengthMm(line) : 0
        })(),
        onClose: () => setShowLengthAdjustModal(false),
        onApply: (mode: LengthAdjustMode, value: number) => {
          const targets = shapes.filter(
            (shape): shape is LineShape => shape.type === 'line' && selectedShapeIdSet.has(shape.id),
          )
          if (targets.length === 0) {
            setStatus('Select one or more lines to adjust')
            setShowLengthAdjustModal(false)
            return
          }
          if (mode === 'none') {
            setShowLengthAdjustModal(false)
            setStatus('Length adjustment skipped')
            return
          }
          setShapes((previous) =>
            previous.map((shape) => {
              if (shape.type !== 'line' || !selectedShapeIdSet.has(shape.id)) {
                return shape
              }
              return mode === 'length'
                ? setLineLength(shape, value)
                : scaleLineLengthByRatio(shape, value)
            }),
          )
          setShowLengthAdjustModal(false)
          setStatus(
            mode === 'length'
              ? `Set length to ${value.toFixed(2)}mm on ${targets.length} line(s)`
              : `Scaled length by ${(value * 100).toFixed(1)}% on ${targets.length} line(s)`,
          )
        },
      },
      svgImportOptionsModalProps,
    },
    projectMemoModalProps: {
      open: showProjectMemoModal,
      onClose: () => setShowProjectMemoModal(false),
      value: projectMemo,
      onChange: (nextValue: string) => setProjectMemo(nextValue.slice(0, 8000)),
    },
    pieceInspectorModalProps: isMobileLayout
      ? {
          ...pieceInspectorContentProps,
          open: showPieceInspectorModal && pieceInspectorContentProps.piece !== null,
          onClose: () => setShowPieceInspectorModal(false),
        }
      : null,
    nestingModalProps: {
      open: showNestingModal,
      onClose: () => setShowNestingModal(false),
      patternPieces,
      pieceGrainlines,
      patternPieceChainsByShapeId,
      selectedShapeIds: selectedShapeIdSet,
      activeLayerId,
      activeLineTypeId,
      onApplyNesting: (createdShapes: Shape[]) => {
        setShapes((previous) => [...previous, ...createdShapes])
        setShowNestingModal(false)
        setStatus(`Nesting applied: ${createdShapes.length} shapes created`)
      },
    },
    hiddenInputsProps: {
      fileInputRef,
      svgInputRef,
      tracingInputRef,
      templateImportInputRef,
      catalogImportInputRef,
      translationInputRef,
      onLoadJson: handleLoadJson,
      onImportSvg: handleImportSvg,
      onImportTracing: handleImportTracing,
      onImportTemplateRepositoryFile: handleImportTemplateRepositoryFile,
      onImportCatalogFile: handleImportCatalogFile,
      onImportTranslation: (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        void file.text().then((raw: string) => {
          const map = parseTranslationFile(raw)
          setTranslationMap(map)
          saveTranslationMap(map)
          setStatus(`Loaded ${Object.keys(map).length} translation entries`)
        })
      },
    },
    fontInputRef,
    onFontInputChange,
  }
}
