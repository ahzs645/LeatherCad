import type { Shape } from '../cad/cad-types'

type ContextualActionsPanelProps = {
  selectedShapes: Shape[]
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
  onApplySeamAllowance: () => void
  onClearSeamAllowance: () => void
  onCreatePatternPiece: () => void
  onEditPatternPiece: () => void
  canEditPatternPiece: boolean
  onApplyTextDefaults: () => void
}

export function ContextualActionsPanel({
  selectedShapes,
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
  onApplySeamAllowance,
  onClearSeamAllowance,
  onCreatePatternPiece,
  onEditPatternPiece,
  canEditPatternPiece,
  onApplyTextDefaults,
}: ContextualActionsPanelProps) {
  if (selectedShapes.length === 0) {
    return null
  }

  const selectedCount = selectedShapes.length
  const lineCount = selectedShapes.filter((shape) => shape.type === 'line').length
  const textCount = selectedShapes.filter((shape) => shape.type === 'text').length

  return (
    <section className="contextual-actions-panel">
      <div className="contextual-actions-title">Contextual Actions</div>
      <div className="contextual-actions-meta">
        {selectedCount} selected | {lineCount} lines | {textCount} text
      </div>
      <div className="contextual-actions-grid">
        <button onClick={onAlignX} disabled={selectedCount < 2}>
          Align X
        </button>
        <button onClick={onAlignY} disabled={selectedCount < 2}>
          Align Y
        </button>
        <button onClick={onAlignBoth} disabled={selectedCount < 2}>
          Align XY
        </button>
        <button onClick={onAlignToGrid}>Align to Grid</button>
        <button onClick={onCreateOffset}>Offset</button>
        <button onClick={onCreateBoxStitch}>Box Stitch</button>
        <button onClick={onBevelCorner} disabled={lineCount < 2}>
          Bevel Corner
        </button>
        <button onClick={onRoundCorner} disabled={lineCount < 2}>
          Round Corner
        </button>
        <button onClick={onAddEdgeConstraint}>Add Edge Constraint</button>
        <button onClick={onAddAlignConstraints} disabled={selectedCount < 2}>
          Add Align Constraints
        </button>
        <button onClick={onApplyConstraints}>Apply Constraints</button>
        <button onClick={onCreatePatternPiece} disabled={selectedCount !== 1}>
          Create Piece
        </button>
        <button onClick={onEditPatternPiece} disabled={!canEditPatternPiece}>
          Edit Piece
        </button>
        <button onClick={onApplySeamAllowance}>Apply Seam Allowance</button>
        <button onClick={onClearSeamAllowance}>Clear Seam Allowance</button>
        <button onClick={onApplyTextDefaults} disabled={textCount === 0}>
          Apply Text Defaults
        </button>
      </div>
    </section>
  )
}
