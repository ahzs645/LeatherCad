import { clamp } from '../../cad/cad-geometry'
import type { HardwareKind, HardwareMarker, Shape, TextTransformMode } from '../../cad/cad-types'

type ShapeNodeEditorBlockProps = {
  selectedEditableShape: Shape | null
  onUpdateSelectedShapePoint: (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => void
}

export function ShapeNodeEditorBlock({
  selectedEditableShape,
  onUpdateSelectedShapePoint,
}: ShapeNodeEditorBlockProps) {
  return (
    <div className="control-block">
      <h3>Shape Node Editor</h3>
      {selectedEditableShape ? (
        <div className="line-type-edit-grid">
          <label className="field-row">
            <span>Start X</span>
            <input
              type="number"
              step={0.1}
              value={selectedEditableShape.start.x}
              onChange={(event) => onUpdateSelectedShapePoint('start', 'x', Number(event.target.value) || 0)}
            />
          </label>
          <label className="field-row">
            <span>Start Y</span>
            <input
              type="number"
              step={0.1}
              value={selectedEditableShape.start.y}
              onChange={(event) => onUpdateSelectedShapePoint('start', 'y', Number(event.target.value) || 0)}
            />
          </label>
          {selectedEditableShape.type === 'arc' && (
            <>
              <label className="field-row">
                <span>Mid X</span>
                <input
                  type="number"
                  step={0.1}
                  value={selectedEditableShape.mid.x}
                  onChange={(event) => onUpdateSelectedShapePoint('mid', 'x', Number(event.target.value) || 0)}
                />
              </label>
              <label className="field-row">
                <span>Mid Y</span>
                <input
                  type="number"
                  step={0.1}
                  value={selectedEditableShape.mid.y}
                  onChange={(event) => onUpdateSelectedShapePoint('mid', 'y', Number(event.target.value) || 0)}
                />
              </label>
            </>
          )}
          {selectedEditableShape.type === 'bezier' && (
            <>
              <label className="field-row">
                <span>Control X</span>
                <input
                  type="number"
                  step={0.1}
                  value={selectedEditableShape.control.x}
                  onChange={(event) => onUpdateSelectedShapePoint('control', 'x', Number(event.target.value) || 0)}
                />
              </label>
              <label className="field-row">
                <span>Control Y</span>
                <input
                  type="number"
                  step={0.1}
                  value={selectedEditableShape.control.y}
                  onChange={(event) => onUpdateSelectedShapePoint('control', 'y', Number(event.target.value) || 0)}
                />
              </label>
            </>
          )}
          <label className="field-row">
            <span>End X</span>
            <input
              type="number"
              step={0.1}
              value={selectedEditableShape.end.x}
              onChange={(event) => onUpdateSelectedShapePoint('end', 'x', Number(event.target.value) || 0)}
            />
          </label>
          <label className="field-row">
            <span>End Y</span>
            <input
              type="number"
              step={0.1}
              value={selectedEditableShape.end.y}
              onChange={(event) => onUpdateSelectedShapePoint('end', 'y', Number(event.target.value) || 0)}
            />
          </label>
        </div>
      ) : (
        <p className="hint">Select exactly one shape in Move tool to edit points.</p>
      )}
    </div>
  )
}

type TextDefaultsBlockProps = {
  selectedShapeCount: number
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
  onSetActiveTool: (tool: 'hardware' | 'pan' | 'text') => void
}

export function TextDefaultsBlock({
  selectedShapeCount,
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
  onSetActiveTool,
}: TextDefaultsBlockProps) {
  return (
    <div className="control-block">
      <h3>Text + Fonts</h3>
      <div className="line-type-edit-grid">
        <label className="field-row">
          <span>Text</span>
          <input value={textDraftValue} onChange={(event) => onSetTextDraftValue(event.target.value)} />
        </label>
        <label className="field-row">
          <span>Font</span>
          <select className="action-select" value={textFontFamily} onChange={(event) => onSetTextFontFamily(event.target.value)}>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Arial, sans-serif">Arial</option>
          </select>
        </label>
        <label className="field-row">
          <span>Size (mm)</span>
          <input
            type="number"
            min={2}
            max={120}
            step={0.5}
            value={textFontSizeMm}
            onChange={(event) => onSetTextFontSizeMm(clamp(Number(event.target.value) || 2, 2, 120))}
          />
        </label>
        <label className="field-row">
          <span>Transform</span>
          <select className="action-select" value={textTransformMode} onChange={(event) => onSetTextTransformMode(event.target.value as TextTransformMode)}>
            <option value="none">None</option>
            <option value="arch">Arch</option>
            <option value="ring">Ring</option>
          </select>
        </label>
        <label className="field-row">
          <span>Radius (mm)</span>
          <input
            type="number"
            min={2}
            max={2000}
            step={1}
            value={textRadiusMm}
            onChange={(event) => onSetTextRadiusMm(clamp(Number(event.target.value) || 2, 2, 2000))}
          />
        </label>
        <label className="field-row">
          <span>Sweep (deg)</span>
          <input
            type="number"
            min={-1080}
            max={1080}
            step={1}
            value={textSweepDeg}
            onChange={(event) => onSetTextSweepDeg(clamp(Number(event.target.value) || 0, -1080, 1080))}
          />
        </label>
      </div>
      <div className="line-type-modal-actions">
        <button onClick={() => onSetActiveTool('text')}>Use Text Tool</button>
        <button onClick={onApplyTextDefaultsToSelection} disabled={selectedShapeCount === 0}>
          Apply To Selected Text
        </button>
        <button onClick={() => onSetActiveTool('pan')}>Back to Move Tool</button>
      </div>
    </div>
  )
}

type HardwareMarkerBlockProps = {
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
}

export function HardwareMarkerBlock({
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
}: HardwareMarkerBlockProps) {
  return (
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
  )
}
