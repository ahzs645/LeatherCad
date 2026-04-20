import type { ChangeEvent, RefObject } from 'react'
import type { Backdrop } from '../cad/cad-types'
import { getBackdropRedoDepth, getBackdropUndoDepth } from '../ops/backdrop-ops'

type BackdropModalProps = {
  open: boolean
  onClose: () => void
  backdrops: Backdrop[]
  activeBackdrop: Backdrop | null
  onSelectBackdrop: (id: string | null) => void
  onImportBackdrop: () => void
  onDeleteActiveBackdrop: () => void
  onUpdateBackdrop: (id: string, patch: Partial<Backdrop>) => void
  onBackdropUndo: (id: string) => void
  onBackdropRedo: (id: string) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function BackdropModal({
  open,
  onClose,
  backdrops,
  activeBackdrop,
  onSelectBackdrop,
  onImportBackdrop,
  onDeleteActiveBackdrop,
  onUpdateBackdrop,
  onBackdropUndo,
  onBackdropRedo,
  fileInputRef,
  onFileChange,
}: BackdropModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Backdrops">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Backdrops</h3>

        <div className="button-row">
          <button onClick={onImportBackdrop}>Import image…</button>
          <button onClick={onDeleteActiveBackdrop} disabled={!activeBackdrop}>
            Delete
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {backdrops.length === 0 && (
          <p className="muted">No backdrops. Import an image to embed a permanent reference layer.</p>
        )}

        {backdrops.length > 0 && (
          <ul className="entry-list">
            {backdrops.map((backdrop) => (
              <li key={backdrop.id}>
                <button
                  className={activeBackdrop?.id === backdrop.id ? 'active' : ''}
                  onClick={() => onSelectBackdrop(backdrop.id)}
                >
                  {backdrop.name} ({backdrop.bitmapWidth}×{backdrop.bitmapHeight}px)
                </button>
              </li>
            ))}
          </ul>
        )}

        {activeBackdrop && (
          <>
            <h4>Selected: {activeBackdrop.name}</h4>

            <div className="button-row">
              <button
                onClick={() => onBackdropUndo(activeBackdrop.id)}
                disabled={getBackdropUndoDepth(activeBackdrop.id) === 0}
              >
                Undo ({getBackdropUndoDepth(activeBackdrop.id)})
              </button>
              <button
                onClick={() => onBackdropRedo(activeBackdrop.id)}
                disabled={getBackdropRedoDepth(activeBackdrop.id) === 0}
              >
                Redo ({getBackdropRedoDepth(activeBackdrop.id)})
              </button>
            </div>

            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={activeBackdrop.visible}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { visible: e.target.checked })}
              />
              <span>Visible</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={activeBackdrop.locked}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { locked: e.target.checked })}
              />
              <span>Locked (prevent drag)</span>
            </label>

            <label className="field-row">
              <span>X (mm)</span>
              <input
                type="number"
                step={0.5}
                value={activeBackdrop.leftTop.x}
                onChange={(e) =>
                  onUpdateBackdrop(activeBackdrop.id, {
                    leftTop: { x: Number(e.target.value), y: activeBackdrop.leftTop.y },
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Y (mm)</span>
              <input
                type="number"
                step={0.5}
                value={activeBackdrop.leftTop.y}
                onChange={(e) =>
                  onUpdateBackdrop(activeBackdrop.id, {
                    leftTop: { x: activeBackdrop.leftTop.x, y: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Width (mm)</span>
              <input
                type="number"
                step={1}
                min={1}
                value={activeBackdrop.width}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { width: Number(e.target.value) })}
              />
            </label>
            <label className="field-row">
              <span>Height (mm)</span>
              <input
                type="number"
                step={1}
                min={1}
                value={activeBackdrop.height}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { height: Number(e.target.value) })}
              />
            </label>
            <label className="field-row">
              <span>Angle (deg)</span>
              <input
                type="number"
                step={1}
                value={activeBackdrop.angleDeg}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { angleDeg: Number(e.target.value) })}
              />
            </label>
            <label className="field-row">
              <span>Opacity</span>
              <input
                type="number"
                step={0.05}
                min={0.05}
                max={1}
                value={activeBackdrop.opacity}
                onChange={(e) => onUpdateBackdrop(activeBackdrop.id, { opacity: Number(e.target.value) })}
              />
            </label>
            <label className="field-row">
              <span>DPI (optional, calibrates mm size)</span>
              <input
                type="number"
                step={1}
                min={0}
                value={activeBackdrop.dpi ?? 0}
                onChange={(e) => {
                  const dpi = Number(e.target.value)
                  onUpdateBackdrop(activeBackdrop.id, { dpi: dpi > 0 ? dpi : undefined })
                }}
              />
            </label>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
