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
  onSetPdfTracingPage: (overlay: TracingOverlay, pageNumber: number) => void
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
  onSetPdfTracingPage,
}: TracingModalProps) {
  if (!open) {
    return null
  }
  const pdfPageCount = activeTracingOverlay?.kind === 'pdf' ? (activeTracingOverlay.pdfPageCount ?? 1) : 1
  const pdfPageNumber = activeTracingOverlay?.kind === 'pdf' ? (activeTracingOverlay.pdfPageNumber ?? 1) : 1

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
            <div className="tracing-preview-panel">
              <div className="tracing-preview-media">
                <img src={activeTracingOverlay.sourceUrl} alt={activeTracingOverlay.name} />
              </div>
              <div className="tracing-preview-meta">
                <span>{activeTracingOverlay.kind === 'pdf' ? `PDF page ${pdfPageNumber}/${pdfPageCount}` : 'Image'}</span>
                <span>
                  {Math.round(activeTracingOverlay.width)} x {Math.round(activeTracingOverlay.height)} px
                </span>
                <span>{activeTracingOverlay.dpi ? `${activeTracingOverlay.dpi} dpi` : 'DPI unset'}</span>
              </div>
            </div>
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
            <label className="field-row">
              <span>DPI (physical scale)</span>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="(unset)"
                value={activeTracingOverlay.dpi ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  onUpdateTracingOverlay(activeTracingOverlay.id, {
                    dpi: Number.isFinite(value) && value > 0 ? value : undefined,
                  })
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const dpi = activeTracingOverlay.dpi
                  if (!dpi || dpi <= 0) return
                  // Apply DPI: scale so 1 image-pixel = 25.4/dpi mm.
                  const mmPerPixel = 25.4 / dpi
                  onUpdateTracingOverlay(activeTracingOverlay.id, { scale: mmPerPixel })
                }}
                disabled={!activeTracingOverlay.dpi}
                title="Set scale from DPI"
              >
                Apply DPI
              </button>
            </label>
            <details>
              <summary>Calibrate by ruler</summary>
              <p className="hint">
                Pick two points on the image (in image pixels) whose real-world distance you know,
                then enter that distance below. Apply derives a DPI and rescales the overlay.
              </p>
              <button
                type="button"
                onClick={() => {
                  const sx = Number(window.prompt('Start X (px)', '0'))
                  if (!Number.isFinite(sx)) return
                  const sy = Number(window.prompt('Start Y (px)', '0'))
                  if (!Number.isFinite(sy)) return
                  const ex = Number(window.prompt('End X (px)', '100'))
                  if (!Number.isFinite(ex)) return
                  const ey = Number(window.prompt('End Y (px)', '0'))
                  if (!Number.isFinite(ey)) return
                  const mm = Number(window.prompt('Measured length (mm)', '100'))
                  if (!Number.isFinite(mm) || mm <= 0) return
                  const pixelDist = Math.hypot(ex - sx, ey - sy)
                  if (pixelDist < 1) return
                  const dpi = (pixelDist / mm) * 25.4
                  const mmPerPixel = 25.4 / dpi
                  onUpdateTracingOverlay(activeTracingOverlay.id, {
                    dpi: Math.round(dpi * 10) / 10,
                    scale: mmPerPixel,
                  })
                }}
              >
                Calibrate…
              </button>
            </details>
            {activeTracingOverlay.kind === 'pdf' && pdfPageCount > 1 && (
              <div className="field-row">
                <span>PDF Page</span>
                <div className="line-type-modal-actions">
                  <button
                    type="button"
                    onClick={() => onSetPdfTracingPage(activeTracingOverlay, pdfPageNumber - 1)}
                    disabled={pdfPageNumber <= 1}
                  >
                    Previous
                  </button>
                  <select
                    className="action-select"
                    value={pdfPageNumber}
                    onChange={(event) => onSetPdfTracingPage(activeTracingOverlay, Number(event.target.value))}
                  >
                    {Array.from({ length: pdfPageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <option key={pageNumber} value={pageNumber}>
                        Page {pageNumber}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onSetPdfTracingPage(activeTracingOverlay, pdfPageNumber + 1)}
                    disabled={pdfPageNumber >= pdfPageCount}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
