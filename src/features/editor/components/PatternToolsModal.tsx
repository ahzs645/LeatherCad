import type {
  ConstraintAxis,
  ConstraintEdge,
  HardwareKind,
  HardwareMarker,
  Layer,
  ParametricConstraint,
  Shape,
  SketchGroup,
  SnapSettings,
  TextTransformMode,
} from '../cad/cad-types'
import type { BooleanOp, OffsetJoinType } from '../ops/clipper-ops'
import {
  HardwareMarkerBlock,
  ShapeNodeEditorBlock,
  TextDefaultsBlock,
} from './pattern-tools/PatternToolsEditors'
import {
  AiBuilderBlock,
  BooleanOperationsBlock,
  ClipperPathOffsetBlock,
  ConstraintsBlock,
  GeometryActionsBlock,
  PatternNestingBlock,
  SeamOffsetsBlock,
  SketchAnnotationsBlock,
  SnapAlignBlock,
  TextToPathBlock,
} from './pattern-tools/PatternToolsSections'

type SketchLinkMode = NonNullable<SketchGroup['linkMode']>

type PatternToolsModalProps = {
  open: boolean
  onClose: () => void
  snapSettings: SnapSettings
  onSetSnapSettings: (next: SnapSettings | ((previous: SnapSettings) => SnapSettings)) => void
  selectedShapeCount: number
  onAlignSelection: (axis: 'x' | 'y' | 'both') => void
  onAlignSelectionToGrid: () => void
  activeLayer: Layer | null
  activeLayerId: string | null
  sketchGroups: SketchGroup[]
  activeSketchGroup: SketchGroup | null
  onSetActiveSketchGroupId: (groupId: string | null) => void
  onCreateSketchGroupFromSelection: () => void
  onCreateLinkedSketchGroup: (mode: SketchLinkMode) => void
  onDuplicateActiveSketchGroup: () => void
  onRenameActiveSketchGroup: () => void
  onToggleActiveSketchGroupVisibility: () => void
  onToggleActiveSketchGroupLock: () => void
  onSetActiveSketchLink: (patch: {
    baseGroupId?: string | null
    linkMode?: SketchGroup['linkMode']
    linkOffsetX?: number
    linkOffsetY?: number
  }) => void
  onClearActiveSketchLink: () => void
  onClearActiveSketchGroup: () => void
  onDeleteActiveSketchGroup: () => void
  onSetActiveLayerAnnotation: (annotation: string) => void
  onSetActiveSketchAnnotation: (annotation: string) => void
  showAnnotations: boolean
  onSetShowAnnotations: (show: boolean) => void
  constraintEdge: ConstraintEdge
  onSetConstraintEdge: (edge: ConstraintEdge) => void
  constraintOffsetMm: number
  onSetConstraintOffsetMm: (offsetMm: number) => void
  constraintAxis: ConstraintAxis
  onSetConstraintAxis: (axis: ConstraintAxis) => void
  onAddEdgeConstraintFromSelection: () => void
  onAddAlignConstraintsFromSelection: () => void
  onApplyConstraints: () => void
  constraints: ParametricConstraint[]
  onToggleConstraintEnabled: (constraintId: string) => void
  onDeleteConstraint: (constraintId: string) => void
  seamAllowanceInputMm: number
  onSetSeamAllowanceInputMm: (value: number) => void
  onApplySeamAllowanceToSelection: () => void
  onClearSeamAllowanceOnSelection: () => void
  onClearAllSeamAllowances: () => void
  seamAllowanceCount: number
  onBevelSelectedCorner: () => void
  onRoundSelectedCorner: () => void
  onCreateOffsetGeometryFromSelection: () => void
  onCreateBoxStitchFromSelection: () => void
  selectedEditableShape: Shape | null
  onUpdateSelectedShapePoint: (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => void
  textDraftValue: string
  onSetTextDraftValue: (value: string) => void
  textFontFamily: string
  onSetTextFontFamily: (value: string) => void
  textFontSizeMm: number
  onSetTextFontSizeMm: (value: number) => void
  textTransformMode: TextTransformMode
  onSetTextTransformMode: (value: TextTransformMode) => void
  textRadiusMm: number
  onSetTextRadiusMm: (value: number) => void
  textSweepDeg: number
  onSetTextSweepDeg: (value: number) => void
  onApplyTextDefaultsToSelection: () => void
  hardwarePreset: HardwareKind
  onSetHardwarePreset: (preset: HardwareKind) => void
  customHardwareDiameterMm: number
  onSetCustomHardwareDiameterMm: (value: number) => void
  customHardwareSpacingMm: number
  onSetCustomHardwareSpacingMm: (value: number) => void
  onSetActiveTool: (tool: 'hardware' | 'pan' | 'text') => void
  selectedHardwareMarker: HardwareMarker | null
  onUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  onDeleteSelectedHardwareMarker: () => void
  onBooleanOp: (op: BooleanOp) => void
  onClipperOffset: (offsetMm: number, joinType: OffsetJoinType) => void
  onTextToPath: () => void
  onOpenAiBuilder: () => void
  onOpenNesting: () => void
}

export function PatternToolsModal({
  open,
  onClose,
  snapSettings,
  onSetSnapSettings,
  selectedShapeCount,
  onAlignSelection,
  onAlignSelectionToGrid,
  activeLayer,
  activeLayerId,
  sketchGroups,
  activeSketchGroup,
  onSetActiveSketchGroupId,
  onCreateSketchGroupFromSelection,
  onCreateLinkedSketchGroup,
  onDuplicateActiveSketchGroup,
  onRenameActiveSketchGroup,
  onToggleActiveSketchGroupVisibility,
  onToggleActiveSketchGroupLock,
  onSetActiveSketchLink,
  onClearActiveSketchLink,
  onClearActiveSketchGroup,
  onDeleteActiveSketchGroup,
  onSetActiveLayerAnnotation,
  onSetActiveSketchAnnotation,
  showAnnotations,
  onSetShowAnnotations,
  constraintEdge,
  onSetConstraintEdge,
  constraintOffsetMm,
  onSetConstraintOffsetMm,
  constraintAxis,
  onSetConstraintAxis,
  onAddEdgeConstraintFromSelection,
  onAddAlignConstraintsFromSelection,
  onApplyConstraints,
  constraints,
  onToggleConstraintEnabled,
  onDeleteConstraint,
  seamAllowanceInputMm,
  onSetSeamAllowanceInputMm,
  onApplySeamAllowanceToSelection,
  onClearSeamAllowanceOnSelection,
  onClearAllSeamAllowances,
  seamAllowanceCount,
  onBevelSelectedCorner,
  onRoundSelectedCorner,
  onCreateOffsetGeometryFromSelection,
  onCreateBoxStitchFromSelection,
  selectedEditableShape,
  onUpdateSelectedShapePoint,
  textDraftValue,
  onSetTextDraftValue,
  textFontFamily,
  onSetTextFontFamily,
  textFontSizeMm,
  onSetTextFontSizeMm,
  textTransformMode,
  onSetTextTransformMode,
  textRadiusMm,
  onSetTextRadiusMm,
  textSweepDeg,
  onSetTextSweepDeg,
  onApplyTextDefaultsToSelection,
  hardwarePreset,
  onSetHardwarePreset,
  customHardwareDiameterMm,
  onSetCustomHardwareDiameterMm,
  customHardwareSpacingMm,
  onSetCustomHardwareSpacingMm,
  onSetActiveTool,
  selectedHardwareMarker,
  onUpdateSelectedHardwareMarker,
  onDeleteSelectedHardwareMarker,
  onBooleanOp,
  onClipperOffset,
  onTextToPath,
  onOpenAiBuilder,
  onOpenNesting,
}: PatternToolsModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      role="presentation"
    >
      <div className="line-type-modal pattern-tools-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="line-type-modal-header">
          <h2>Pattern Tools</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">
          Manage sub-sketches, constraints, seam offsets, snapping, annotations, and hardware markers from one panel.
        </p>

        <SnapAlignBlock
          snapSettings={snapSettings}
          onSetSnapSettings={onSetSnapSettings}
          selectedShapeCount={selectedShapeCount}
          onAlignSelection={onAlignSelection}
          onAlignSelectionToGrid={onAlignSelectionToGrid}
        />

        <SketchAnnotationsBlock
          selectedShapeCount={selectedShapeCount}
          activeLayer={activeLayer}
          activeLayerId={activeLayerId}
          sketchGroups={sketchGroups}
          activeSketchGroup={activeSketchGroup}
          onSetActiveSketchGroupId={onSetActiveSketchGroupId}
          onCreateSketchGroupFromSelection={onCreateSketchGroupFromSelection}
          onCreateLinkedSketchGroup={onCreateLinkedSketchGroup}
          onDuplicateActiveSketchGroup={onDuplicateActiveSketchGroup}
          onRenameActiveSketchGroup={onRenameActiveSketchGroup}
          onToggleActiveSketchGroupVisibility={onToggleActiveSketchGroupVisibility}
          onToggleActiveSketchGroupLock={onToggleActiveSketchGroupLock}
          onSetActiveSketchLink={onSetActiveSketchLink}
          onClearActiveSketchLink={onClearActiveSketchLink}
          onClearActiveSketchGroup={onClearActiveSketchGroup}
          onDeleteActiveSketchGroup={onDeleteActiveSketchGroup}
          onSetActiveLayerAnnotation={onSetActiveLayerAnnotation}
          onSetActiveSketchAnnotation={onSetActiveSketchAnnotation}
          showAnnotations={showAnnotations}
          onSetShowAnnotations={onSetShowAnnotations}
        />

        <ConstraintsBlock
          selectedShapeCount={selectedShapeCount}
          constraintEdge={constraintEdge}
          onSetConstraintEdge={onSetConstraintEdge}
          constraintOffsetMm={constraintOffsetMm}
          onSetConstraintOffsetMm={onSetConstraintOffsetMm}
          constraintAxis={constraintAxis}
          onSetConstraintAxis={onSetConstraintAxis}
          onAddEdgeConstraintFromSelection={onAddEdgeConstraintFromSelection}
          onAddAlignConstraintsFromSelection={onAddAlignConstraintsFromSelection}
          onApplyConstraints={onApplyConstraints}
          constraints={constraints}
          onToggleConstraintEnabled={onToggleConstraintEnabled}
          onDeleteConstraint={onDeleteConstraint}
        />

        <SeamOffsetsBlock
          selectedShapeCount={selectedShapeCount}
          seamAllowanceInputMm={seamAllowanceInputMm}
          onSetSeamAllowanceInputMm={onSetSeamAllowanceInputMm}
          onApplySeamAllowanceToSelection={onApplySeamAllowanceToSelection}
          onClearSeamAllowanceOnSelection={onClearSeamAllowanceOnSelection}
          onClearAllSeamAllowances={onClearAllSeamAllowances}
          seamAllowanceCount={seamAllowanceCount}
        />

        <GeometryActionsBlock
          selectedShapeCount={selectedShapeCount}
          onBevelSelectedCorner={onBevelSelectedCorner}
          onRoundSelectedCorner={onRoundSelectedCorner}
          onCreateOffsetGeometryFromSelection={onCreateOffsetGeometryFromSelection}
          onCreateBoxStitchFromSelection={onCreateBoxStitchFromSelection}
        />

        <ShapeNodeEditorBlock
          selectedEditableShape={selectedEditableShape}
          onUpdateSelectedShapePoint={onUpdateSelectedShapePoint}
        />

        <TextDefaultsBlock
          selectedShapeCount={selectedShapeCount}
          textDraftValue={textDraftValue}
          onSetTextDraftValue={onSetTextDraftValue}
          textFontFamily={textFontFamily}
          onSetTextFontFamily={onSetTextFontFamily}
          textFontSizeMm={textFontSizeMm}
          onSetTextFontSizeMm={onSetTextFontSizeMm}
          textTransformMode={textTransformMode}
          onSetTextTransformMode={onSetTextTransformMode}
          textRadiusMm={textRadiusMm}
          onSetTextRadiusMm={onSetTextRadiusMm}
          textSweepDeg={textSweepDeg}
          onSetTextSweepDeg={onSetTextSweepDeg}
          onApplyTextDefaultsToSelection={onApplyTextDefaultsToSelection}
          onSetActiveTool={onSetActiveTool}
        />

        <HardwareMarkerBlock
          hardwarePreset={hardwarePreset}
          onSetHardwarePreset={onSetHardwarePreset}
          customHardwareDiameterMm={customHardwareDiameterMm}
          onSetCustomHardwareDiameterMm={onSetCustomHardwareDiameterMm}
          customHardwareSpacingMm={customHardwareSpacingMm}
          onSetCustomHardwareSpacingMm={onSetCustomHardwareSpacingMm}
          onSetActiveTool={onSetActiveTool}
          selectedHardwareMarker={selectedHardwareMarker}
          onUpdateSelectedHardwareMarker={onUpdateSelectedHardwareMarker}
          onDeleteSelectedHardwareMarker={onDeleteSelectedHardwareMarker}
        />

        <AiBuilderBlock onOpenAiBuilder={onOpenAiBuilder} />
        <BooleanOperationsBlock selectedShapeCount={selectedShapeCount} onBooleanOp={onBooleanOp} />
        <ClipperPathOffsetBlock selectedShapeCount={selectedShapeCount} onClipperOffset={onClipperOffset} />
        <TextToPathBlock selectedShapeCount={selectedShapeCount} onTextToPath={onTextToPath} />
        <PatternNestingBlock onOpenNesting={onOpenNesting} />
      </div>
    </div>
  )
}
