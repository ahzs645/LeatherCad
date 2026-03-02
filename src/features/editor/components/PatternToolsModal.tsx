import { clamp } from '../cad/cad-geometry'
import type {
  ConstraintAxis,
  ConstraintEdge,
  HardwareKind,
  HardwareMarker,
  Layer,
  ParametricConstraint,
  SketchGroup,
  SnapSettings,
} from '../cad/cad-types'

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
  onDuplicateActiveSketchGroup: () => void
  onRenameActiveSketchGroup: () => void
  onToggleActiveSketchGroupVisibility: () => void
  onToggleActiveSketchGroupLock: () => void
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
  hardwarePreset: HardwareKind
  onSetHardwarePreset: (preset: HardwareKind) => void
  customHardwareDiameterMm: number
  onSetCustomHardwareDiameterMm: (value: number) => void
  customHardwareSpacingMm: number
  onSetCustomHardwareSpacingMm: (value: number) => void
  onSetActiveTool: (tool: 'hardware' | 'pan') => void
  selectedHardwareMarker: HardwareMarker | null
  onUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  onDeleteSelectedHardwareMarker: () => void
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
  onDuplicateActiveSketchGroup,
  onRenameActiveSketchGroup,
  onToggleActiveSketchGroupVisibility,
  onToggleActiveSketchGroupLock,
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
          <h3>Hardware Markers</h3>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Preset</span>
              <select className="action-select" value={hardwarePreset} onChange={(event) => onSetHardwarePreset(event.target.value as HardwareKind)}>
                <option value="snap">Snap</option>
                <option value="rivet">Rivet</option>
                <option value="buckle">Buckle</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="field-row">
              <span>Custom hole (mm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={customHardwareDiameterMm}
                disabled={hardwarePreset !== 'custom'}
                onChange={(event) => onSetCustomHardwareDiameterMm(clamp(Number(event.target.value) || 0.1, 0.1, 120))}
              />
            </label>
            <label className="field-row">
              <span>Custom spacing (mm)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={customHardwareSpacingMm}
                disabled={hardwarePreset !== 'custom'}
                onChange={(event) => onSetCustomHardwareSpacingMm(clamp(Number(event.target.value) || 0, 0, 300))}
              />
            </label>
          </div>
          <div className="line-type-modal-actions">
            <button onClick={() => onSetActiveTool('hardware')}>Use Hardware Tool</button>
            <button onClick={() => onSetActiveTool('pan')}>Back to Move Tool</button>
          </div>
          <p className="hint">Pick the Hardware tool, then click on canvas to place markers with metadata for holes and spacing.</p>

          {selectedHardwareMarker ? (
            <div className="line-type-edit-grid">
              <label className="field-row">
                <span>Label</span>
                <input value={selectedHardwareMarker.label} onChange={(event) => onUpdateSelectedHardwareMarker({ label: event.target.value })} />
              </label>
              <label className="field-row">
                <span>Hole diameter (mm)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={selectedHardwareMarker.holeDiameterMm}
                  onChange={(event) =>
                    onUpdateSelectedHardwareMarker({
                      holeDiameterMm: clamp(Number(event.target.value) || 0.1, 0.1, 120),
                    })
                  }
                />
              </label>
              <label className="field-row">
                <span>Spacing (mm)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={selectedHardwareMarker.spacingMm}
                  onChange={(event) =>
                    onUpdateSelectedHardwareMarker({
                      spacingMm: clamp(Number(event.target.value) || 0, 0, 300),
                    })
                  }
                />
              </label>
              <label className="field-row">
                <span>Notes</span>
                <input
                  value={selectedHardwareMarker.notes ?? ''}
                  placeholder="e.g. set with #9 snap"
                  onChange={(event) => onUpdateSelectedHardwareMarker({ notes: event.target.value })}
                />
              </label>
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={selectedHardwareMarker.visible}
                  onChange={(event) => onUpdateSelectedHardwareMarker({ visible: event.target.checked })}
                />
                <span>Visible</span>
              </label>
              <div className="line-type-modal-actions">
                <button onClick={onDeleteSelectedHardwareMarker}>Delete Marker</button>
              </div>
            </div>
          ) : (
            <p className="hint">Select a hardware marker in Move tool to edit metadata.</p>
          )}
        </div>
      </div>
    </div>
  )
}
