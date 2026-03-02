import { clamp } from '../cad/cad-geometry'
import type { TracingOverlay } from '../cad/cad-types'

type TracingModalProps = {
  open: boolean
  onClose: () => void
  tracingOverlays: TracingOverlay[]
  activeTracingOverlay: TracingOverlay | null
  onImportTracing: () => void
  onDeleteActiveTracing: () => void
  onSetActiveTracingOverlayId: (overlayId: string | null) => void
  onUpdateTracingOverlay: (overlayId: string, patch: Partial<TracingOverlay>) => void
}

export function TracingModal({
  open,
  onClose,
  tracingOverlays,
  activeTracingOverlay,
  onImportTracing,
  onDeleteActiveTracing,
  onSetActiveTracingOverlayId,
  onUpdateTracingOverlay,
}: TracingModalProps) {
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
      <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="layer-color-modal-header">
          <h2>Tracing Overlays</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <div className="line-type-modal-actions">
          <button onClick={onImportTracing}>Import Image/PDF</button>
          <button onClick={onDeleteActiveTracing} disabled={!activeTracingOverlay}>
            Delete Active
          </button>
        </div>

        <label className="field-row">
          <span>Active tracing</span>
          <select
            className="action-select"
            value={activeTracingOverlay?.id ?? ''}
            onChange={(event) => onSetActiveTracingOverlayId(event.target.value || null)}
          >
            {tracingOverlays.map((overlay) => (
              <option key={overlay.id} value={overlay.id}>
                {overlay.name} [{overlay.kind}]
              </option>
            ))}
          </select>
        </label>

        {activeTracingOverlay ? (
          <div className="control-block">
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={activeTracingOverlay.visible}
                onChange={(event) => onUpdateTracingOverlay(activeTracingOverlay.id, { visible: event.target.checked })}
              />
              <span>Visible</span>
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={activeTracingOverlay.locked}
                onChange={(event) => onUpdateTracingOverlay(activeTracingOverlay.id, { locked: event.target.checked })}
              />
              <span>Lock editing</span>
            </label>
            <label className="field-row">
              <span>Opacity</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={activeTracingOverlay.opacity}
                onChange={(event) =>
                  onUpdateTracingOverlay(activeTracingOverlay.id, {
                    opacity: clamp(Number(event.target.value), 0.05, 1),
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Scale</span>
              <input
                type="number"
                min={0.05}
                max={20}
                step={0.05}
                value={activeTracingOverlay.scale}
                onChange={(event) =>
                  onUpdateTracingOverlay(activeTracingOverlay.id, {
                    scale: clamp(Number(event.target.value) || 1, 0.05, 20),
                  })
                }
              />
            </label>
            <label className="field-row">
              <span>Rotation (deg)</span>
              <input
                type="number"
                step={1}
                value={activeTracingOverlay.rotationDeg}
                onChange={(event) =>
                  onUpdateTracingOverlay(activeTracingOverlay.id, {
                    rotationDeg: Number(event.target.value) || 0,
                  })
                }
              />
            </label>
            <div className="line-type-edit-grid">
              <label className="field-row">
                <span>Offset X</span>
                <input
                  type="number"
                  step={1}
                  value={activeTracingOverlay.offsetX}
                  disabled={activeTracingOverlay.locked}
                  onChange={(event) =>
                    onUpdateTracingOverlay(activeTracingOverlay.id, {
                      offsetX: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="field-row">
                <span>Offset Y</span>
                <input
                  type="number"
                  step={1}
                  value={activeTracingOverlay.offsetY}
                  disabled={activeTracingOverlay.locked}
                  onChange={(event) =>
                    onUpdateTracingOverlay(activeTracingOverlay.id, {
                      offsetY: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>
            </div>
          </div>
        ) : (
          <p className="hint">Import a tracing file to begin.</p>
        )}
      </div>
    </div>
  )
}
