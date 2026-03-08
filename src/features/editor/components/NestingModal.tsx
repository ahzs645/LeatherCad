import { useState } from 'react'
import type { Shape } from '../cad/cad-types'
import { shapesToNestingPieces, nestPieces, type NestingResult, type NestingConfig, DEFAULT_NESTING_CONFIG } from '../ops/nesting-ops'
import { polygonToLineShapes } from '../ops/polygon-ops'

type NestingModalProps = {
  open: boolean
  onClose: () => void
  shapes: Shape[]
  selectedShapeIds: Set<string>
  activeLayerId: string
  activeLineTypeId: string
  onApplyNesting: (createdShapes: Shape[]) => void
}

export function NestingModal({
  open,
  onClose,
  shapes,
  selectedShapeIds,
  activeLayerId,
  activeLineTypeId,
  onApplyNesting,
}: NestingModalProps) {
  const [hideWidth, setHideWidth] = useState(900)
  const [hideHeight, setHideHeight] = useState(600)
  const [spacing, setSpacing] = useState(DEFAULT_NESTING_CONFIG.spacing)
  const [iterations, setIterations] = useState(DEFAULT_NESTING_CONFIG.iterations)
  const [rotations, setRotations] = useState('0,90,180,270')
  const [result, setResult] = useState<NestingResult | null>(null)
  const [status, setStatus] = useState('')

  if (!open) return null

  function runNesting() {
    const pieces = shapesToNestingPieces(shapes, selectedShapeIds)
    if (pieces.length === 0) {
      setStatus('No valid polygons found in selection. Select closed shapes.')
      setResult(null)
      return
    }

    const rotArray = rotations
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))

    const config: NestingConfig = {
      rotations: rotArray.length > 0 ? rotArray : [0],
      spacing: Math.max(0, spacing),
      iterations: Math.max(1, iterations),
    }

    const nestResult = nestPieces(pieces, hideWidth, hideHeight, config)
    setResult(nestResult)
    setStatus(
      `Placed ${nestResult.placements.length} piece(s), ` +
      `waste: ${nestResult.wastePercent.toFixed(1)}%, ` +
      `${nestResult.unplaced.length} unplaced`,
    )
  }

  function applyResult() {
    if (!result) return

    const created: Shape[] = []

    // Create hide boundary rectangle
    const hideShapes = polygonToLineShapes(
      [
        { x: 0, y: 0 },
        { x: hideWidth, y: 0 },
        { x: hideWidth, y: hideHeight },
        { x: 0, y: hideHeight },
      ],
      activeLayerId,
      activeLineTypeId,
      undefined,
      true,
    )
    created.push(...hideShapes)

    // Create nested piece outlines
    for (const placement of result.placements) {
      const lines = polygonToLineShapes(
        placement.polygon,
        activeLayerId,
        activeLineTypeId,
        undefined,
        true,
      )
      created.push(...lines)
    }

    onApplyNesting(created)
    setStatus(`Applied nesting: ${created.length} shapes created`)
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      role="presentation"
    >
      <div
        className="line-type-modal pattern-tools-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="line-type-modal-header">
          <h2>Pattern Nesting (NFP)</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">
          Select pattern pieces, define hide dimensions, and run the nesting algorithm
          to optimize layout and minimize waste.
        </p>

        <div className="control-block">
          <h3>Hide Dimensions</h3>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Width (mm)</span>
              <input
                type="number"
                step={10}
                min={100}
                value={hideWidth}
                onChange={(e) => setHideWidth(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </label>
            <label className="field-row">
              <span>Height (mm)</span>
              <input
                type="number"
                step={10}
                min={100}
                value={hideHeight}
                onChange={(e) => setHideHeight(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </label>
          </div>
        </div>

        <div className="control-block">
          <h3>Nesting Settings</h3>
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Spacing (mm)</span>
              <input
                type="number"
                step={0.5}
                min={0}
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
            <label className="field-row">
              <span>Iterations</span>
              <input
                type="number"
                step={1}
                min={1}
                max={20}
                value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
            <label className="field-row">
              <span>Rotations (deg)</span>
              <input
                type="text"
                value={rotations}
                onChange={(e) => setRotations(e.target.value)}
                style={{ width: 120 }}
                placeholder="0,90,180,270"
              />
            </label>
          </div>
        </div>

        <div className="control-block">
          <div className="line-type-modal-actions">
            <button onClick={runNesting}>
              Run Nesting ({selectedShapeIds.size} shape{selectedShapeIds.size !== 1 ? 's' : ''})
            </button>
            {result && (
              <button onClick={applyResult}>
                Apply Nesting Layout
              </button>
            )}
          </div>

          {status && <p className="hint">{status}</p>}

          {result && (
            <div style={{ marginTop: 8 }}>
              <p className="hint">
                Pieces placed: {result.placements.length} |
                Unplaced: {result.unplaced.length} |
                Used area: {result.usedArea.toFixed(0)} mm² |
                Waste: {result.wastePercent.toFixed(1)}%
              </p>
              {result.unplaced.length > 0 && (
                <p className="hint" style={{ color: '#f97316' }}>
                  Unplaced pieces: {result.unplaced.join(', ')}
                </p>
              )}

              {/* Simple SVG preview */}
              <svg
                viewBox={`-5 -5 ${hideWidth + 10} ${hideHeight + 10}`}
                style={{ width: '100%', maxHeight: 200, border: '1px solid #334155', borderRadius: 4, marginTop: 4 }}
              >
                {/* Hide boundary */}
                <rect
                  x={0} y={0} width={hideWidth} height={hideHeight}
                  fill="none" stroke="#475569" strokeWidth={1}
                />
                {/* Placed pieces */}
                {result.placements.map((p, i) => {
                  const path = p.polygon.map((pt, j) =>
                    `${j === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
                  ).join(' ') + ' Z'
                  return (
                    <path
                      key={i}
                      d={path}
                      fill="#3b82f620"
                      stroke="#3b82f6"
                      strokeWidth={0.5}
                    />
                  )
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
