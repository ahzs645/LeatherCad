import { useState, type ChangeEvent } from 'react'
import type { LeatherImageFill } from '../cad/cad-types'

type LeatherImageFillSectionProps = {
  leatherImageFills: LeatherImageFill[]
  activeLeatherImageFill: LeatherImageFill | null
  selectedShapeCount: number
  onSetActiveLeatherImageFillId: (fillId: string | null) => void
  onImportLeatherImageFill: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdateLeatherImageFill: (fillId: string, patch: Partial<LeatherImageFill>) => void
  onDeleteActiveLeatherImageFill: () => void
  onAssignSelectedToActiveLeatherImageFill: () => void
  onClearSelectedFromActiveLeatherImageFill: () => void
}

export function LeatherImageFillSection({
  leatherImageFills,
  activeLeatherImageFill,
  selectedShapeCount,
  onSetActiveLeatherImageFillId,
  onImportLeatherImageFill,
  onUpdateLeatherImageFill,
  onDeleteActiveLeatherImageFill,
  onAssignSelectedToActiveLeatherImageFill,
  onClearSelectedFromActiveLeatherImageFill,
}: LeatherImageFillSectionProps) {
  const [calibrationPixels, setCalibrationPixels] = useState(100)
  const [calibrationMm, setCalibrationMm] = useState(100)

  return (
    <>
      <div className="line-type-modal-actions">
        <label className="button-like-file-input">
          <span>Import Image</span>
          <input type="file" accept="image/*" className="hidden-input" onChange={onImportLeatherImageFill} />
        </label>
        <button onClick={onDeleteActiveLeatherImageFill} disabled={!activeLeatherImageFill}>
          Delete Active
        </button>
      </div>

      {leatherImageFills.length > 0 && (
        <label className="field-row">
          <span>Active image</span>
          <select
            value={activeLeatherImageFill?.id ?? ''}
            onChange={(event) => onSetActiveLeatherImageFillId(event.target.value || null)}
          >
            {leatherImageFills.map((fill) => (
              <option key={fill.id} value={fill.id}>
                {fill.name} ({fill.assignedShapeIds.length})
              </option>
            ))}
          </select>
        </label>
      )}

      {activeLeatherImageFill && (
        <div className="line-type-edit-grid">
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={activeLeatherImageFill.visible}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, { visible: event.target.checked })
              }
            />
            <span>Visible</span>
          </label>
          <label className="field-row">
            <span>Opacity</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={activeLeatherImageFill.opacity}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, { opacity: Number(event.target.value) })
              }
            />
          </label>
          <label className="field-row">
            <span>X</span>
            <input
              type="number"
              step={1}
              value={activeLeatherImageFill.x}
              onChange={(event) => onUpdateLeatherImageFill(activeLeatherImageFill.id, { x: Number(event.target.value) })}
            />
          </label>
          <label className="field-row">
            <span>Y</span>
            <input
              type="number"
              step={1}
              value={activeLeatherImageFill.y}
              onChange={(event) => onUpdateLeatherImageFill(activeLeatherImageFill.id, { y: Number(event.target.value) })}
            />
          </label>
          <label className="field-row">
            <span>Width</span>
            <input
              type="number"
              min={1}
              step={1}
              value={activeLeatherImageFill.widthMm}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, { widthMm: Number(event.target.value) })
              }
            />
          </label>
          <label className="field-row">
            <span>Height</span>
            <input
              type="number"
              min={1}
              step={1}
              value={activeLeatherImageFill.heightMm}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, { heightMm: Number(event.target.value) })
              }
            />
          </label>
          <label className="field-row">
            <span>Rotation</span>
            <input
              type="number"
              step={1}
              value={activeLeatherImageFill.rotationDeg}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, { rotationDeg: Number(event.target.value) })
              }
            />
          </label>
          <div className="line-type-modal-actions" aria-label="Quick rotate leather image">
            <button
              type="button"
              onClick={() =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  rotationDeg: ((activeLeatherImageFill.rotationDeg - 90) % 360 + 360) % 360,
                })
              }
            >
              ↺ 90°
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  rotationDeg: ((activeLeatherImageFill.rotationDeg + 90) % 360 + 360) % 360,
                })
              }
            >
              ↻ 90°
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  rotationDeg: activeLeatherImageFill.rotationDeg - 1,
                })
              }
            >
              ↺ 1°
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  rotationDeg: activeLeatherImageFill.rotationDeg + 1,
                })
              }
            >
              ↻ 1°
            </button>
          </div>
          <label className="field-row">
            <span>DPI</span>
            <input
              type="number"
              min={1}
              step={1}
              value={activeLeatherImageFill.dpi ?? ''}
              onChange={(event) => {
                const value = Number(event.target.value)
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  dpi: Number.isFinite(value) && value > 0 ? value : undefined,
                })
              }}
            />
          </label>
          <label className="field-row">
            <span>Crop X</span>
            <input
              type="number"
              min={0}
              step={1}
              value={activeLeatherImageFill.crop.x}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  crop: { ...activeLeatherImageFill.crop, x: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="field-row">
            <span>Crop Y</span>
            <input
              type="number"
              min={0}
              step={1}
              value={activeLeatherImageFill.crop.y}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  crop: { ...activeLeatherImageFill.crop, y: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="field-row">
            <span>Crop W</span>
            <input
              type="number"
              min={1}
              step={1}
              value={activeLeatherImageFill.crop.width}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  crop: { ...activeLeatherImageFill.crop, width: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="field-row">
            <span>Crop H</span>
            <input
              type="number"
              min={1}
              step={1}
              value={activeLeatherImageFill.crop.height}
              onChange={(event) =>
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  crop: { ...activeLeatherImageFill.crop, height: Number(event.target.value) },
                })
              }
            />
          </label>
        </div>
      )}

      {activeLeatherImageFill && (
        <>
          <div className="line-type-modal-actions">
            <button onClick={onAssignSelectedToActiveLeatherImageFill} disabled={selectedShapeCount === 0}>
              Assign Selected
            </button>
            <button onClick={onClearSelectedFromActiveLeatherImageFill} disabled={selectedShapeCount === 0}>
              Clear Selected
            </button>
          </div>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Pixels</span>
              <input
                type="number"
                min={1}
                step={1}
                value={calibrationPixels}
                onChange={(event) => setCalibrationPixels(Number(event.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Length mm</span>
              <input
                type="number"
                min={1}
                step={1}
                value={calibrationMm}
                onChange={(event) => setCalibrationMm(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (calibrationPixels <= 0 || calibrationMm <= 0) {
                  return
                }
                onUpdateLeatherImageFill(activeLeatherImageFill.id, {
                  dpi: Math.round(((calibrationPixels / calibrationMm) * 25.4) * 10) / 10,
                })
              }}
            >
              Calibrate
            </button>
          </div>
        </>
      )}
    </>
  )
}
