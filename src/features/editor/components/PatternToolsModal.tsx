import { useState } from 'react'
import { clamp } from '../cad/cad-geometry'
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
  // Boolean operations
  onBooleanOp: (op: BooleanOp) => void
  // Clipper path offset
  onClipperOffset: (offsetMm: number, joinType: OffsetJoinType) => void
  // Text to path
  onTextToPath: () => void
  onOpenAiBuilder: () => void
  // Nesting
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
  const [clipperOffsetMm, setClipperOffsetMm] = useState(3)
  const [clipperJoinType, setClipperJoinType] = useState<OffsetJoinType>('round')

  if (!open) {
    return null
  }

  const hasActiveSketchLink = Boolean(activeSketchGroup?.baseGroupId)

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

        <div className="control-block">
          <h3>Snap + Align</h3>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={snapSettings.enabled}
              onChange={(event) =>
                onSetSnapSettings((previous) => ({
                  ...previous,
                  enabled: event.target.checked,
                }))
              }
            />
            <span>Enable snapping</span>
          </label>
          <div className="pattern-toggle-grid">
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={snapSettings.grid}
                onChange={(event) =>
                  onSetSnapSettings((previous) => ({
                    ...previous,
                    grid: event.target.checked,
                  }))
                }
              />
              <span>Grid</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={snapSettings.endpoints}
                onChange={(event) =>
                  onSetSnapSettings((previous) => ({
                    ...previous,
                    endpoints: event.target.checked,
                  }))
                }
              />
              <span>Endpoints</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={snapSettings.midpoints}
                onChange={(event) =>
                  onSetSnapSettings((previous) => ({
                    ...previous,
                    midpoints: event.target.checked,
                  }))
                }
              />
              <span>Midpoints</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={snapSettings.guides}
                onChange={(event) =>
                  onSetSnapSettings((previous) => ({
                    ...previous,
                    guides: event.target.checked,
                  }))
                }
              />
              <span>Guides</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={snapSettings.hardware}
                onChange={(event) =>
                  onSetSnapSettings((previous) => ({
                    ...previous,
                    hardware: event.target.checked,
                  }))
                }
              />
              <span>Hardware</span>
            </label>
          </div>
          <label className="field-row">
            <span>Grid snap step (mm)</span>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={snapSettings.gridStep}
              onChange={(event) =>
                onSetSnapSettings((previous) => ({
                  ...previous,
                  gridStep: clamp(Number(event.target.value) || 0.1, 0.1, 1000),
                }))
              }
            />
          </label>
          <div className="button-row">
            <button onClick={() => onAlignSelection('x')} disabled={selectedShapeCount < 2}>
              Align X
            </button>
            <button onClick={() => onAlignSelection('y')} disabled={selectedShapeCount < 2}>
              Align Y
            </button>
            <button onClick={() => onAlignSelection('both')} disabled={selectedShapeCount < 2}>
              Align XY
            </button>
            <button onClick={onAlignSelectionToGrid} disabled={selectedShapeCount === 0}>
              Align to Grid
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Sub-Sketches + Annotations</h3>
          <label className="field-row">
            <span>Active sub-sketch</span>
            <select className="action-select" value={activeSketchGroup?.id ?? ''} onChange={(event) => onSetActiveSketchGroupId(event.target.value || null)}>
              <option value="">None</option>
              {sketchGroups
                .filter((group) => group.layerId === activeLayerId)
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.visible ? '' : ' (hidden)'}
                    {group.locked ? ' (locked)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <div className="line-type-modal-actions">
            <button onClick={onCreateSketchGroupFromSelection} disabled={selectedShapeCount === 0}>
              Create from Selection
            </button>
            <button onClick={() => onCreateLinkedSketchGroup('copy')} disabled={!activeSketchGroup}>
              Linked Copy
            </button>
            <button onClick={() => onCreateLinkedSketchGroup('mirror-x')} disabled={!activeSketchGroup}>
              Linked Mirror X
            </button>
            <button onClick={() => onCreateLinkedSketchGroup('mirror-y')} disabled={!activeSketchGroup}>
              Linked Mirror Y
            </button>
            <button onClick={onDuplicateActiveSketchGroup} disabled={!activeSketchGroup}>
              Place Copy
            </button>
            <button onClick={onRenameActiveSketchGroup} disabled={!activeSketchGroup}>
              Rename
            </button>
            <button onClick={onToggleActiveSketchGroupVisibility} disabled={!activeSketchGroup}>
              {activeSketchGroup?.visible ? 'Hide' : 'Show'}
            </button>
            <button onClick={onToggleActiveSketchGroupLock} disabled={!activeSketchGroup}>
              {activeSketchGroup?.locked ? 'Unlock' : 'Lock'}
            </button>
            <button onClick={onClearActiveSketchGroup} disabled={!activeSketchGroup}>
              Clear Active
            </button>
            <button onClick={onDeleteActiveSketchGroup} disabled={!activeSketchGroup}>
              Delete Sub-Sketch
            </button>
          </div>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Base sketch link</span>
              <select
                className="action-select"
                value={activeSketchGroup?.baseGroupId ?? ''}
                onChange={(event) =>
                  onSetActiveSketchLink({
                    baseGroupId: event.target.value || null,
                  })
                }
                disabled={!activeSketchGroup}
              >
                <option value="">None (local only)</option>
                {sketchGroups
                  .filter((group) => !activeSketchGroup || group.id !== activeSketchGroup.id)
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.layerId === activeLayerId ? 'active layer' : 'other layer'})
                    </option>
                  ))}
              </select>
            </label>
            <label className="field-row">
              <span>Link mode</span>
              <select
                className="action-select"
                value={activeSketchGroup?.linkMode ?? 'copy'}
                onChange={(event) =>
                  onSetActiveSketchLink({
                    linkMode: event.target.value as SketchGroup['linkMode'],
                  })
                }
                disabled={!hasActiveSketchLink}
              >
                <option value="copy">Copy</option>
                <option value="mirror-x">Mirror X</option>
                <option value="mirror-y">Mirror Y</option>
              </select>
            </label>
            <label className="field-row">
              <span>Link offset X (mm)</span>
              <input
                type="number"
                step={1}
                value={activeSketchGroup?.linkOffsetX ?? 0}
                onChange={(event) =>
                  onSetActiveSketchLink({
                    linkOffsetX: Number(event.target.value) || 0,
                  })
                }
                disabled={!hasActiveSketchLink}
              />
            </label>
            <label className="field-row">
              <span>Link offset Y (mm)</span>
              <input
                type="number"
                step={1}
                value={activeSketchGroup?.linkOffsetY ?? 0}
                onChange={(event) =>
                  onSetActiveSketchLink({
                    linkOffsetY: Number(event.target.value) || 0,
                  })
                }
                disabled={!hasActiveSketchLink}
              />
            </label>
          </div>
          <div className="button-row">
            <button onClick={onClearActiveSketchLink} disabled={!hasActiveSketchLink}>
              Unlink Base Sketch
            </button>
          </div>
          <p className="hint">
            Linked sketches stay connected to their base sketch and can still include extra local edits.
          </p>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Layer annotation</span>
              <input value={activeLayer?.annotation ?? ''} placeholder="e.g. Main body" onChange={(event) => onSetActiveLayerAnnotation(event.target.value)} />
            </label>
            <label className="field-row">
              <span>Sub-sketch annotation</span>
              <input
                value={activeSketchGroup?.annotation ?? ''}
                placeholder="e.g. Inner pocket"
                onChange={(event) => onSetActiveSketchAnnotation(event.target.value)}
                disabled={!activeSketchGroup}
              />
            </label>
          </div>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={showAnnotations} onChange={(event) => onSetShowAnnotations(event.target.checked)} />
            <span>Show annotation labels on canvas</span>
          </label>
        </div>

        <div className="control-block">
          <h3>Parametric Constraints</h3>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Edge</span>
              <select className="action-select" value={constraintEdge} onChange={(event) => onSetConstraintEdge(event.target.value as ConstraintEdge)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
            <label className="field-row">
              <span>Offset (mm)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={constraintOffsetMm}
                onChange={(event) => onSetConstraintOffsetMm(clamp(Number(event.target.value) || 0, 0, 999))}
              />
            </label>
            <label className="field-row">
              <span>Align axis</span>
              <select className="action-select" value={constraintAxis} onChange={(event) => onSetConstraintAxis(event.target.value as ConstraintAxis)}>
                <option value="x">X</option>
                <option value="y">Y</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
          <div className="line-type-modal-actions">
            <button onClick={onAddEdgeConstraintFromSelection} disabled={selectedShapeCount === 0}>
              Add Edge Offset
            </button>
            <button onClick={onAddAlignConstraintsFromSelection} disabled={selectedShapeCount < 2}>
              Add Align Rules
            </button>
            <button onClick={onApplyConstraints} disabled={constraints.length === 0}>
              Apply Constraints
            </button>
          </div>
          {constraints.length === 0 ? (
            <p className="hint">No constraints yet.</p>
          ) : (
            <div className="template-list pattern-constraint-list">
              {constraints.map((constraint) => (
                <div key={constraint.id} className="pattern-constraint-item">
                  <label className="layer-toggle-item">
                    <input type="checkbox" checked={constraint.enabled} onChange={() => onToggleConstraintEnabled(constraint.id)} />
                    <span>{constraint.name}</span>
                  </label>
                  <span className="template-item-meta">
                    {constraint.type === 'edge-offset' ? `${constraint.edge} @ ${constraint.offsetMm.toFixed(1)}mm` : `Align ${constraint.axis}`}
                  </span>
                  <button onClick={() => onDeleteConstraint(constraint.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="control-block">
          <h3>Seam Offsets</h3>
          <label className="field-row">
            <span>Offset distance (mm)</span>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={seamAllowanceInputMm}
              onChange={(event) => onSetSeamAllowanceInputMm(clamp(Number(event.target.value) || 0.1, 0.1, 150))}
            />
          </label>
          <div className="line-type-modal-actions">
            <button onClick={onApplySeamAllowanceToSelection} disabled={selectedShapeCount === 0}>
              Apply to Selection
            </button>
            <button onClick={onClearSeamAllowanceOnSelection} disabled={selectedShapeCount === 0}>
              Clear on Selection
            </button>
            <button onClick={onClearAllSeamAllowances} disabled={seamAllowanceCount === 0}>
              Clear All
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Corners + Geometry</h3>
          <p className="hint">Use two connected lines for bevel/round. Offset and the box stitch helper use current selection.</p>
          <div className="line-type-modal-actions">
            <button onClick={onBevelSelectedCorner} disabled={selectedShapeCount < 2}>
              Bevel Corner
            </button>
            <button onClick={onRoundSelectedCorner} disabled={selectedShapeCount < 2}>
              Round Corner
            </button>
            <button onClick={onCreateOffsetGeometryFromSelection} disabled={selectedShapeCount === 0}>
              Create Offset Geometry
            </button>
            <button onClick={onCreateBoxStitchFromSelection} disabled={selectedShapeCount === 0}>
              Box Stitch Helper
            </button>
          </div>
        </div>

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

        <div className="control-block">
          <h3>AI Builder</h3>
          <p className="hint">
            Generate a copyable prompt with supported primitives, then validate pasted AI JSON before loading or inserting it.
          </p>
          <div className="line-type-modal-actions">
            <button onClick={onOpenAiBuilder}>Open AI Builder</button>
          </div>
        </div>

        <div className="control-block">
          <h3>Boolean Operations</h3>
          <p className="hint">
            Select 2+ shapes. For Difference: first-selected group is subject, rest is clip.
          </p>
          <div className="line-type-modal-actions">
            <button disabled={selectedShapeCount < 2} onClick={() => onBooleanOp('union')}>
              Union
            </button>
            <button disabled={selectedShapeCount < 2} onClick={() => onBooleanOp('difference')}>
              Difference
            </button>
            <button disabled={selectedShapeCount < 2} onClick={() => onBooleanOp('intersection')}>
              Intersect
            </button>
            <button disabled={selectedShapeCount < 2} onClick={() => onBooleanOp('xor')}>
              XOR
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Clipper Path Offset</h3>
          <p className="hint">
            Robust polygon offset with corner treatment. Replaces naive perpendicular offset for closed shapes.
          </p>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Offset (mm)</span>
              <input
                type="number"
                step={0.5}
                value={clipperOffsetMm}
                onChange={(e) => setClipperOffsetMm(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
            <label className="field-row">
              <span>Join Type</span>
              <select
                value={clipperJoinType}
                onChange={(e) => setClipperJoinType(e.target.value as OffsetJoinType)}
              >
                <option value="round">Round</option>
                <option value="miter">Miter</option>
                <option value="square">Square</option>
              </select>
            </label>
          </div>
          <div className="line-type-modal-actions">
            <button
              disabled={selectedShapeCount === 0}
              onClick={() => onClipperOffset(clipperOffsetMm, clipperJoinType)}
            >
              Offset Selection (Clipper)
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Text to Path</h3>
          <p className="hint">
            Convert selected text shapes to vector outlines using OpenType.js font metrics.
          </p>
          <div className="line-type-modal-actions">
            <button disabled={selectedShapeCount === 0} onClick={onTextToPath}>
              Convert Text to Paths
            </button>
          </div>
        </div>

        <div className="control-block">
          <h3>Pattern Nesting</h3>
          <p className="hint">
            NFP nesting algorithm to optimize pattern placement and minimize leather waste.
          </p>
          <div className="line-type-modal-actions">
            <button onClick={onOpenNesting}>Open Nesting Tool</button>
          </div>
        </div>
      </div>
    </div>
  )
}
