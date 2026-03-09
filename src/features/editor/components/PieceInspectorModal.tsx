import { useEffect, useMemo, useRef } from 'react'
import type { PatternPiece, PieceGrainline, PieceLabel, PieceNotch, PieceSeamAllowance, Shape } from '../cad/cad-types'
import { AVAILABLE_PIECE_LABEL_TOKENS } from '../ops/pattern-piece-ops'

type PieceInspectorModalProps = {
  open: boolean
  piece: PatternPiece | null
  grainline: PieceGrainline | null
  pieceLabel: PieceLabel | null
  patternLabel: PieceLabel | null
  seamAllowance: PieceSeamAllowance | null
  notches: PieceNotch[]
  edgeCount: number
  availableInternalShapes: Shape[]
  selectedInternalShapeIds: Set<string>
  onClose: () => void
  onUpdatePiece: (patch: Partial<PatternPiece>) => void
  onToggleInternalShape: (shapeId: string, included: boolean) => void
  onUpdateGrainline: (patch: Partial<PieceGrainline>) => void
  onUpdatePieceLabel: (patch: Partial<PieceLabel>) => void
  onUpdatePatternLabel: (patch: Partial<PieceLabel>) => void
  onUpdateSeamAllowance: (patch: Partial<PieceSeamAllowance>) => void
  onUpdateNotch: (notchId: string, patch: Partial<PieceNotch>) => void
  onDeleteNotch: (notchId: string) => void
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function PieceInspectorModal({
  open,
  piece,
  grainline,
  pieceLabel,
  patternLabel,
  seamAllowance,
  notches,
  edgeCount,
  availableInternalShapes,
  selectedInternalShapeIds,
  onClose,
  onUpdatePiece,
  onToggleInternalShape,
  onUpdateGrainline,
  onUpdatePieceLabel,
  onUpdatePatternLabel,
  onUpdateSeamAllowance,
  onUpdateNotch,
  onDeleteNotch,
}: PieceInspectorModalProps) {
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    nameRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const orderedInternalShapes = useMemo(
    () => availableInternalShapes.slice().sort((left, right) => left.id.localeCompare(right.id)),
    [availableInternalShapes],
  )

  if (!open || !piece) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-memo-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pattern piece inspector"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-memo-modal-header">
          <h2>Piece Inspector</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="control-block">
          <h3>Metadata</h3>
          <label className="layer-field">
            <span>Name</span>
            <input ref={nameRef} value={piece.name} onChange={(event) => onUpdatePiece({ name: event.target.value })} />
          </label>
          <label className="layer-field">
            <span>Quantity</span>
            <input
              type="number"
              min={1}
              step={1}
              value={piece.quantity}
              onChange={(event) => onUpdatePiece({ quantity: Math.max(1, Math.round(parseNumber(event.target.value, piece.quantity)) || 1) })}
            />
          </label>
          <label className="layer-field">
            <span>Code</span>
            <input value={piece.code ?? ''} onChange={(event) => onUpdatePiece({ code: event.target.value || undefined })} />
          </label>
          <label className="layer-field">
            <span>Annotation</span>
            <input value={piece.annotation ?? ''} onChange={(event) => onUpdatePiece({ annotation: event.target.value })} />
          </label>
          <label className="layer-field">
            <span>Material</span>
            <input value={piece.material ?? ''} onChange={(event) => onUpdatePiece({ material: event.target.value || undefined })} />
          </label>
          <label className="layer-field">
            <span>Material Side</span>
            <select
              value={piece.materialSide ?? 'either'}
              onChange={(event) => onUpdatePiece({ materialSide: event.target.value as PatternPiece['materialSide'] })}
            >
              <option value="either">Either</option>
              <option value="grain">Grain</option>
              <option value="flesh">Flesh</option>
            </select>
          </label>
          <label className="layer-field">
            <span>Orientation</span>
            <select value={piece.orientation} onChange={(event) => onUpdatePiece({ orientation: event.target.value as PatternPiece['orientation'] })}>
              <option value="any">Any</option>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
          <label className="layer-field">
            <span>Notes</span>
            <input value={piece.notes ?? ''} onChange={(event) => onUpdatePiece({ notes: event.target.value || undefined })} />
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={piece.onFold} onChange={(event) => onUpdatePiece({ onFold: event.target.checked })} />
            <span>On fold</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={piece.mirrorPair === true} onChange={(event) => onUpdatePiece({ mirrorPair: event.target.checked })} />
            <span>Mirror pair</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={piece.allowFlip} onChange={(event) => onUpdatePiece({ allowFlip: event.target.checked })} />
            <span>Allow flip in layout</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={piece.includeInLayout} onChange={(event) => onUpdatePiece({ includeInLayout: event.target.checked })} />
            <span>Include in layout</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={piece.locked} onChange={(event) => onUpdatePiece({ locked: event.target.checked })} />
            <span>Lock piece metadata</span>
          </label>
        </div>

        <div className="control-block">
          <h3>Internal Paths</h3>
          {orderedInternalShapes.length === 0 ? (
            <p className="hint">No additional shapes on this layer are available to link.</p>
          ) : (
            <div className="pattern-toggle-grid">
              {orderedInternalShapes.map((shape) => (
                <label key={shape.id} className="layer-toggle-item">
                  <input
                    type="checkbox"
                    checked={selectedInternalShapeIds.has(shape.id)}
                    onChange={(event) => onToggleInternalShape(shape.id, event.target.checked)}
                  />
                  <span>{`${shape.type} ${shape.id.slice(0, 8)}`}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {grainline && (
          <div className="control-block">
            <h3>Grainline</h3>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={grainline.visible} onChange={(event) => onUpdateGrainline({ visible: event.target.checked })} />
              <span>Show grainline</span>
            </label>
            <label className="layer-field">
              <span>Mode</span>
              <select value={grainline.mode} onChange={(event) => onUpdateGrainline({ mode: event.target.value as PieceGrainline['mode'] })}>
                <option value="auto">Auto</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            <label className="layer-field">
              <span>Length (mm)</span>
              <input
                type="number"
                min={1}
                value={grainline.lengthMm ?? ''}
                onChange={(event) => onUpdateGrainline({ lengthMm: parseNumber(event.target.value, grainline.lengthMm ?? 0) || undefined })}
              />
            </label>
            <label className="layer-field">
              <span>Rotation (deg)</span>
              <input
                type="number"
                value={grainline.rotationDeg}
                onChange={(event) => onUpdateGrainline({ rotationDeg: parseNumber(event.target.value, grainline.rotationDeg) })}
              />
            </label>
          </div>
        )}

        {pieceLabel && (
          <div className="control-block">
            <h3>Piece Label</h3>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={pieceLabel.visible} onChange={(event) => onUpdatePieceLabel({ visible: event.target.checked })} />
              <span>Show label</span>
            </label>
            <label className="layer-field">
              <span>Template</span>
              <input value={pieceLabel.textTemplate} onChange={(event) => onUpdatePieceLabel({ textTemplate: event.target.value })} />
            </label>
            <label className="layer-field">
              <span>Offset X</span>
              <input type="number" value={pieceLabel.offsetX} onChange={(event) => onUpdatePieceLabel({ offsetX: parseNumber(event.target.value, pieceLabel.offsetX) })} />
            </label>
            <label className="layer-field">
              <span>Offset Y</span>
              <input type="number" value={pieceLabel.offsetY} onChange={(event) => onUpdatePieceLabel({ offsetY: parseNumber(event.target.value, pieceLabel.offsetY) })} />
            </label>
            <label className="layer-field">
              <span>Rotation (deg)</span>
              <input type="number" value={pieceLabel.rotationDeg} onChange={(event) => onUpdatePieceLabel({ rotationDeg: parseNumber(event.target.value, pieceLabel.rotationDeg) })} />
            </label>
            <label className="layer-field">
              <span>Font size (mm)</span>
              <input
                type="number"
                min={2}
                value={pieceLabel.fontSizeMm}
                onChange={(event) => onUpdatePieceLabel({ fontSizeMm: Math.max(2, parseNumber(event.target.value, pieceLabel.fontSizeMm)) })}
              />
            </label>
            <p className="hint">Tokens: {AVAILABLE_PIECE_LABEL_TOKENS.join(', ')}</p>
          </div>
        )}

        {patternLabel && (
          <div className="control-block">
            <h3>Pattern Label</h3>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={patternLabel.visible} onChange={(event) => onUpdatePatternLabel({ visible: event.target.checked })} />
              <span>Show pattern label</span>
            </label>
            <label className="layer-field">
              <span>Template</span>
              <input value={patternLabel.textTemplate} onChange={(event) => onUpdatePatternLabel({ textTemplate: event.target.value })} />
            </label>
            <label className="layer-field">
              <span>Rotation (deg)</span>
              <input type="number" value={patternLabel.rotationDeg} onChange={(event) => onUpdatePatternLabel({ rotationDeg: parseNumber(event.target.value, patternLabel.rotationDeg) })} />
            </label>
            <label className="layer-field">
              <span>Font size (mm)</span>
              <input
                type="number"
                min={2}
                value={patternLabel.fontSizeMm}
                onChange={(event) => onUpdatePatternLabel({ fontSizeMm: Math.max(2, parseNumber(event.target.value, patternLabel.fontSizeMm)) })}
              />
            </label>
          </div>
        )}

        {seamAllowance && (
          <div className="control-block">
            <h3>Seam Allowance</h3>
            <label className="layer-toggle-item">
              <input type="checkbox" checked={seamAllowance.enabled} onChange={(event) => onUpdateSeamAllowance({ enabled: event.target.checked })} />
              <span>Enable seam allowance</span>
            </label>
            <label className="layer-field">
              <span>Default offset (mm)</span>
              <input
                type="number"
                min={0}
                value={seamAllowance.defaultOffsetMm}
                onChange={(event) => onUpdateSeamAllowance({ defaultOffsetMm: Math.max(0, parseNumber(event.target.value, seamAllowance.defaultOffsetMm)) })}
              />
            </label>
            <div className="line-type-modal-actions">
              <button
                type="button"
                onClick={() =>
                  onUpdateSeamAllowance({
                    edgeOverrides: [
                      ...seamAllowance.edgeOverrides,
                      {
                        edgeIndex: Math.min(edgeCount > 0 ? edgeCount - 1 : 0, seamAllowance.edgeOverrides.length),
                        offsetMm: seamAllowance.defaultOffsetMm,
                      },
                    ],
                  })
                }
                disabled={edgeCount <= 0}
              >
                Add edge override
              </button>
            </div>
            {seamAllowance.edgeOverrides.length === 0 ? (
              <p className="hint">No edge overrides yet. Add one to vary seam width by boundary segment.</p>
            ) : (
              <div className="pattern-toggle-grid">
                {seamAllowance.edgeOverrides.map((override, index) => (
                  <div key={`${override.edgeIndex}-${index}`} className="layer-toggle-item">
                    <label className="layer-field">
                      <span>Edge</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, edgeCount)}
                        value={override.edgeIndex + 1}
                        onChange={(event) => {
                          const next = seamAllowance.edgeOverrides.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, edgeIndex: Math.max(0, Math.min(Math.max(1, edgeCount) - 1, Math.round(parseNumber(event.target.value, entry.edgeIndex + 1) - 1))) }
                              : entry,
                          )
                          onUpdateSeamAllowance({ edgeOverrides: next })
                        }}
                      />
                    </label>
                    <label className="layer-field">
                      <span>Offset</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={override.offsetMm}
                        onChange={(event) => {
                          const next = seamAllowance.edgeOverrides.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, offsetMm: Math.max(0.1, parseNumber(event.target.value, entry.offsetMm)) }
                              : entry,
                          )
                          onUpdateSeamAllowance({ edgeOverrides: next })
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSeamAllowance({
                          edgeOverrides: seamAllowance.edgeOverrides.filter((_, entryIndex) => entryIndex !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="control-block">
          <h3>Notches</h3>
          {notches.length === 0 ? (
            <p className="hint">Use the Piece Notch tool to place new notches on the boundary.</p>
          ) : (
            <div className="pattern-toggle-grid">
              {notches.map((notch, index) => (
                <div key={notch.id} className="layer-toggle-item">
                  <span>{`${index + 1}. ${notch.style} notch`}</span>
                  <label className="layer-field">
                    <span>Edge</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, edgeCount)}
                      value={notch.edgeIndex + 1}
                      onChange={(event) => onUpdateNotch(notch.id, {
                        edgeIndex: Math.max(0, Math.min(Math.max(1, edgeCount) - 1, Math.round(parseNumber(event.target.value, notch.edgeIndex + 1) - 1))),
                      })}
                    />
                  </label>
                  <label className="layer-field">
                    <span>Position (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(notch.t * 100)}
                      onChange={(event) => onUpdateNotch(notch.id, {
                        t: Math.max(0, Math.min(1, parseNumber(event.target.value, notch.t * 100) / 100)),
                      })}
                    />
                  </label>
                  <label className="layer-field">
                    <span>Style</span>
                    <select value={notch.style} onChange={(event) => onUpdateNotch(notch.id, { style: event.target.value as PieceNotch['style'] })}>
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="v">V</option>
                    </select>
                  </label>
                  <label className="layer-field">
                    <span>Length</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={notch.lengthMm}
                      onChange={(event) => onUpdateNotch(notch.id, { lengthMm: Math.max(0.5, parseNumber(event.target.value, notch.lengthMm)) })}
                    />
                  </label>
                  <label className="layer-field">
                    <span>Width</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={notch.widthMm}
                      onChange={(event) => onUpdateNotch(notch.id, { widthMm: Math.max(0, parseNumber(event.target.value, notch.widthMm)) })}
                    />
                  </label>
                  <label className="layer-toggle-item">
                    <input type="checkbox" checked={notch.showOnSeam} onChange={(event) => onUpdateNotch(notch.id, { showOnSeam: event.target.checked })} />
                    <span>Show on seam</span>
                  </label>
                  <button type="button" onClick={() => onDeleteNotch(notch.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
