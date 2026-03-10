import type { HardwareMarker, Shape, StitchHole, StitchHoleType } from '../cad/cad-types'
import type { InspectorContext } from './workbench-types'

type SelectionInspectorPanelProps = {
  context: InspectorContext
  selectedShapeCount: number
  selectedEditableShape: Shape | null
  selectedStitchHole: StitchHole | null
  selectedHardwareMarker: HardwareMarker | null
  shapeCount: number
  layerCount: number
  onAlignX: () => void
  onAlignY: () => void
  onAlignBoth: () => void
  onAlignToGrid: () => void
  onCreateOffset: () => void
  onCreateBoxStitch: () => void
  onBevelCorner: () => void
  onRoundCorner: () => void
  onAddEdgeConstraint: () => void
  onAddAlignConstraints: () => void
  onApplyConstraints: () => void
  onCreatePatternPiece: () => void
  onOpenPieceTab: () => void
  canOpenPieceTab: boolean
  onApplySeamAllowance: () => void
  onClearSeamAllowance: () => void
  onApplyTextDefaults: () => void
  onUpdateSelectedShapePoint: (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => void
  onUpdateSelectedStitchHole: (patch: Partial<StitchHole>) => void
  onUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  onDeleteSelectedHardwareMarker: () => void
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function SelectionInspectorPanel({
  context,
  selectedShapeCount,
  selectedEditableShape,
  selectedStitchHole,
  selectedHardwareMarker,
  shapeCount,
  layerCount,
  onAlignX,
  onAlignY,
  onAlignBoth,
  onAlignToGrid,
  onCreateOffset,
  onCreateBoxStitch,
  onBevelCorner,
  onRoundCorner,
  onAddEdgeConstraint,
  onAddAlignConstraints,
  onApplyConstraints,
  onCreatePatternPiece,
  onOpenPieceTab,
  canOpenPieceTab,
  onApplySeamAllowance,
  onClearSeamAllowance,
  onApplyTextDefaults,
  onUpdateSelectedShapePoint,
  onUpdateSelectedStitchHole,
  onUpdateSelectedHardwareMarker,
  onDeleteSelectedHardwareMarker,
}: SelectionInspectorPanelProps) {
  const lineCount = context.kind === 'shape-multi'
    ? context.shapes.filter((shape) => shape.type === 'line').length
    : selectedEditableShape?.type === 'line'
      ? 1
      : 0

  return (
    <>
      <div className="control-block">
        <h3>{context.title}</h3>
        <p className="hint">{context.description}</p>
        {context.kind === 'empty' && (
          <p className="hint">{`${shapeCount} shapes across ${layerCount} layers. Select geometry or use the document tree to start editing.`}</p>
        )}
      </div>

      <div className="control-block">
        <h3>Context Actions</h3>
        <div className="workbench-action-grid">
          <button onClick={onAlignX} disabled={selectedShapeCount < 2}>Align X</button>
          <button onClick={onAlignY} disabled={selectedShapeCount < 2}>Align Y</button>
          <button onClick={onAlignBoth} disabled={selectedShapeCount < 2}>Align XY</button>
          <button onClick={onAlignToGrid} disabled={selectedShapeCount === 0}>Grid</button>
          <button onClick={onCreateOffset} disabled={selectedShapeCount === 0}>Offset</button>
          <button onClick={onCreateBoxStitch} disabled={selectedShapeCount === 0}>Box Stitch</button>
          <button onClick={onBevelCorner} disabled={lineCount < 2}>Bevel</button>
          <button onClick={onRoundCorner} disabled={lineCount < 2}>Round</button>
          <button onClick={onAddEdgeConstraint} disabled={selectedShapeCount === 0}>Edge Constraint</button>
          <button onClick={onAddAlignConstraints} disabled={selectedShapeCount < 2}>Align Constraint</button>
          <button onClick={onApplyConstraints} disabled={selectedShapeCount === 0}>Apply Constraints</button>
          <button onClick={onCreatePatternPiece} disabled={selectedShapeCount !== 1}>Create Piece</button>
          <button onClick={onOpenPieceTab} disabled={!canOpenPieceTab}>Piece Tab</button>
          <button onClick={onApplySeamAllowance} disabled={selectedShapeCount === 0}>Apply Seam</button>
          <button onClick={onClearSeamAllowance} disabled={selectedShapeCount === 0}>Clear Seam</button>
          <button onClick={onApplyTextDefaults} disabled={selectedShapeCount === 0}>Text Defaults</button>
        </div>
      </div>

      {selectedEditableShape && (
        <div className="control-block">
          <h3>Geometry</h3>
          <p className="hint">{`${selectedEditableShape.type} on layer ${selectedEditableShape.layerId}`}</p>
          <div className="workbench-field-grid">
            <label className="field-row">
              <span>Start X</span>
              <input
                type="number"
                value={selectedEditableShape.start.x}
                onChange={(event) => onUpdateSelectedShapePoint('start', 'x', parseNumber(event.target.value, selectedEditableShape.start.x))}
              />
            </label>
            <label className="field-row">
              <span>Start Y</span>
              <input
                type="number"
                value={selectedEditableShape.start.y}
                onChange={(event) => onUpdateSelectedShapePoint('start', 'y', parseNumber(event.target.value, selectedEditableShape.start.y))}
              />
            </label>
            {'end' in selectedEditableShape && (
              <>
                <label className="field-row">
                  <span>End X</span>
                  <input
                    type="number"
                    value={selectedEditableShape.end.x}
                    onChange={(event) => onUpdateSelectedShapePoint('end', 'x', parseNumber(event.target.value, selectedEditableShape.end.x))}
                  />
                </label>
                <label className="field-row">
                  <span>End Y</span>
                  <input
                    type="number"
                    value={selectedEditableShape.end.y}
                    onChange={(event) => onUpdateSelectedShapePoint('end', 'y', parseNumber(event.target.value, selectedEditableShape.end.y))}
                  />
                </label>
              </>
            )}
            {selectedEditableShape.type === 'arc' && (
              <>
                <label className="field-row">
                  <span>Mid X</span>
                  <input
                    type="number"
                    value={selectedEditableShape.mid.x}
                    onChange={(event) => onUpdateSelectedShapePoint('mid', 'x', parseNumber(event.target.value, selectedEditableShape.mid.x))}
                  />
                </label>
                <label className="field-row">
                  <span>Mid Y</span>
                  <input
                    type="number"
                    value={selectedEditableShape.mid.y}
                    onChange={(event) => onUpdateSelectedShapePoint('mid', 'y', parseNumber(event.target.value, selectedEditableShape.mid.y))}
                  />
                </label>
              </>
            )}
            {selectedEditableShape.type === 'bezier' && (
              <>
                <label className="field-row">
                  <span>Ctrl X</span>
                  <input
                    type="number"
                    value={selectedEditableShape.control.x}
                    onChange={(event) => onUpdateSelectedShapePoint('control', 'x', parseNumber(event.target.value, selectedEditableShape.control.x))}
                  />
                </label>
                <label className="field-row">
                  <span>Ctrl Y</span>
                  <input
                    type="number"
                    value={selectedEditableShape.control.y}
                    onChange={(event) => onUpdateSelectedShapePoint('control', 'y', parseNumber(event.target.value, selectedEditableShape.control.y))}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {selectedStitchHole && (
        <div className="control-block">
          <h3>Stitch Hole</h3>
          <div className="workbench-field-grid">
            <label className="field-row">
              <span>Type</span>
              <select
                value={selectedStitchHole.holeType}
                onChange={(event) => onUpdateSelectedStitchHole({ holeType: event.target.value as StitchHoleType })}
              >
                <option value="round">Round</option>
                <option value="slit">Slit</option>
              </select>
            </label>
            <label className="field-row">
              <span>Sequence</span>
              <input
                type="number"
                min={1}
                value={selectedStitchHole.sequence}
                onChange={(event) =>
                  onUpdateSelectedStitchHole({
                    sequence: Math.max(1, Math.round(parseNumber(event.target.value, selectedStitchHole.sequence))),
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Angle</span>
              <input
                type="number"
                value={selectedStitchHole.angleDeg}
                onChange={(event) => onUpdateSelectedStitchHole({ angleDeg: parseNumber(event.target.value, selectedStitchHole.angleDeg) })}
              />
            </label>
            <label className="field-row">
              <span>Diameter</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedStitchHole.diameterMm ?? ''}
                onChange={(event) => onUpdateSelectedStitchHole({ diameterMm: parseNumber(event.target.value, selectedStitchHole.diameterMm ?? 0) })}
              />
            </label>
          </div>
        </div>
      )}

      {selectedHardwareMarker && (
        <div className="control-block">
          <h3>Hardware Marker</h3>
          <div className="workbench-field-grid">
            <label className="field-row">
              <span>Kind</span>
              <select
                value={selectedHardwareMarker.kind}
                onChange={(event) => onUpdateSelectedHardwareMarker({ kind: event.target.value as HardwareMarker['kind'] })}
              >
                <option value="snap">Snap</option>
                <option value="rivet">Rivet</option>
                <option value="buckle">Buckle</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="field-row">
              <span>Label</span>
              <input
                value={selectedHardwareMarker.label}
                onChange={(event) => onUpdateSelectedHardwareMarker({ label: event.target.value })}
              />
            </label>
            <label className="field-row">
              <span>Hole dia</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedHardwareMarker.holeDiameterMm}
                onChange={(event) =>
                  onUpdateSelectedHardwareMarker({
                    holeDiameterMm: Math.max(0, parseNumber(event.target.value, selectedHardwareMarker.holeDiameterMm)),
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Spacing</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedHardwareMarker.spacingMm}
                onChange={(event) =>
                  onUpdateSelectedHardwareMarker({
                    spacingMm: Math.max(0, parseNumber(event.target.value, selectedHardwareMarker.spacingMm)),
                  })
                }
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
          </div>
          <div className="button-row">
            <button onClick={onDeleteSelectedHardwareMarker}>Delete Marker</button>
          </div>
        </div>
      )}
    </>
  )
}
