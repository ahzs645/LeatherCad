import { useMemo, useState } from 'react'
import type { DimensionLine } from '../cad/cad-types'

type DimensionInspectorModalProps = {
  open: boolean
  dimensions: DimensionLine[]
  onClose: () => void
  onUpdateDimension: (id: string, patch: Partial<DimensionLine>) => void
  onDeleteDimension?: (id: string) => void
}

function describeDimension(dim: DimensionLine, index: number) {
  const dx = dim.end.x - dim.start.x
  const dy = dim.end.y - dim.start.y
  const length = Math.hypot(dx, dy)
  return `#${index + 1} · ${length.toFixed(2)}mm @ offset ${dim.offsetMm.toFixed(1)}`
}

export function DimensionInspectorModal({
  open,
  dimensions,
  onClose,
  onUpdateDimension,
  onDeleteDimension,
}: DimensionInspectorModalProps) {
  const [explicitSelectedId, setExplicitSelectedId] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!open) return null
    const matched = explicitSelectedId
      ? dimensions.find((dim) => dim.id === explicitSelectedId)
      : null
    return matched ?? dimensions[0] ?? null
  }, [open, dimensions, explicitSelectedId])

  if (!open) {
    return null
  }

  const selectedId = selected?.id ?? null
  const setSelectedId = setExplicitSelectedId

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Dimension Inspector">
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3>Dimension Inspector</h3>

        {dimensions.length === 0 ? (
          <p>No dimension lines in this document.</p>
        ) : (
          <>
            <label className="field-row">
              <span>Dimension</span>
              <select
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(event.target.value || null)}
              >
                {dimensions.map((dim, index) => (
                  <option key={dim.id} value={dim.id}>
                    {describeDimension(dim, index)}
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="line-type-edit-grid">
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={selected.arrowOnly === true}
                    onChange={(event) =>
                      onUpdateDimension(selected.id, { arrowOnly: event.target.checked })
                    }
                  />
                  <span>Arrow only (no value text)</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={selected.singleLine === true}
                    onChange={(event) =>
                      onUpdateDimension(selected.id, { singleLine: event.target.checked })
                    }
                  />
                  <span>Single measure line (do not split around label)</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={selected.textInside === true}
                    onChange={(event) =>
                      onUpdateDimension(selected.id, { textInside: event.target.checked })
                    }
                  />
                  <span>Place text inside the dimension line</span>
                </label>
                <label className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={selected.textReverse === true}
                    onChange={(event) =>
                      onUpdateDimension(selected.id, { textReverse: event.target.checked })
                    }
                  />
                  <span>Reverse text orientation (180°)</span>
                </label>
                <label className="field-row">
                  <span>Precision (decimals)</span>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    step={1}
                    value={selected.precision ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      if (raw === '') {
                        onUpdateDimension(selected.id, { precision: undefined })
                        return
                      }
                      const next = Number.parseInt(raw, 10)
                      if (Number.isFinite(next) && next >= 0) {
                        onUpdateDimension(selected.id, { precision: Math.min(6, Math.max(0, next)) })
                      }
                    }}
                  />
                </label>
                <label className="field-row">
                  <span>Font size (mm)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={0.5}
                    value={selected.fontSizeMm ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      if (raw === '') {
                        onUpdateDimension(selected.id, { fontSizeMm: undefined })
                        return
                      }
                      const next = Number.parseFloat(raw)
                      if (Number.isFinite(next) && next > 0) {
                        onUpdateDimension(selected.id, { fontSizeMm: next })
                      }
                    }}
                  />
                </label>
                <label className="field-row">
                  <span>Offset (mm)</span>
                  <input
                    type="number"
                    step={0.5}
                    value={selected.offsetMm}
                    onChange={(event) => {
                      const next = Number.parseFloat(event.target.value)
                      if (Number.isFinite(next)) {
                        onUpdateDimension(selected.id, { offsetMm: next })
                      }
                    }}
                  />
                </label>
                <label className="field-row">
                  <span>Override text</span>
                  <input
                    type="text"
                    value={selected.text ?? ''}
                    placeholder="auto"
                    onChange={(event) => {
                      const raw = event.target.value
                      onUpdateDimension(selected.id, { text: raw === '' ? undefined : raw })
                    }}
                  />
                </label>
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          {selected && onDeleteDimension && (
            <button
              onClick={() => {
                onDeleteDimension(selected.id)
                setSelectedId(null)
              }}
            >
              Delete
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
