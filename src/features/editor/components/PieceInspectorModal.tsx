import { useEffect } from 'react'
import type {
  PatternPiece,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
} from '../cad/cad-types'
import { PieceInspectorContent } from './PieceInspectorContent'

type PieceSeamConnectionEntry = {
  connection: SeamConnection
  counterpartPieceName: string
}

type PieceInspectorModalProps = {
  open: boolean
  piece: PatternPiece | null
  grainline: PieceGrainline | null
  pieceLabel: PieceLabel | null
  patternLabel: PieceLabel | null
  seamAllowance: PieceSeamAllowance | null
  seamConnections: PieceSeamConnectionEntry[]
  notches: PieceNotch[]
  placementLabels: PiecePlacementLabel[]
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
  onUpdateSeamConnection: (connectionId: string, patch: Partial<SeamConnection>) => void
  onDeleteSeamConnection: (connectionId: string) => void
  onUpdateNotch: (notchId: string, patch: Partial<PieceNotch>) => void
  onDeleteNotch: (notchId: string) => void
  onAddPlacementLabel: () => void
  onUpdatePlacementLabel: (labelId: string, patch: Partial<PiecePlacementLabel>) => void
  onDeletePlacementLabel: (labelId: string) => void
}

export function PieceInspectorModal({
  open,
  piece,
  grainline,
  pieceLabel,
  patternLabel,
  seamAllowance,
  seamConnections,
  notches,
  placementLabels,
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
  onUpdateSeamConnection,
  onDeleteSeamConnection,
  onUpdateNotch,
  onDeleteNotch,
  onAddPlacementLabel,
  onUpdatePlacementLabel,
  onDeletePlacementLabel,
}: PieceInspectorModalProps) {
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

        <PieceInspectorContent
          piece={piece}
          grainline={grainline}
          pieceLabel={pieceLabel}
          patternLabel={patternLabel}
          seamAllowance={seamAllowance}
          seamConnections={seamConnections}
          notches={notches}
          placementLabels={placementLabels}
          edgeCount={edgeCount}
          availableInternalShapes={availableInternalShapes}
          selectedInternalShapeIds={selectedInternalShapeIds}
          autoFocusName
          onUpdatePiece={onUpdatePiece}
          onToggleInternalShape={onToggleInternalShape}
          onUpdateGrainline={onUpdateGrainline}
          onUpdatePieceLabel={onUpdatePieceLabel}
          onUpdatePatternLabel={onUpdatePatternLabel}
          onUpdateSeamAllowance={onUpdateSeamAllowance}
          onUpdateSeamConnection={onUpdateSeamConnection}
          onDeleteSeamConnection={onDeleteSeamConnection}
          onUpdateNotch={onUpdateNotch}
          onDeleteNotch={onDeleteNotch}
          onAddPlacementLabel={onAddPlacementLabel}
          onUpdatePlacementLabel={onUpdatePlacementLabel}
          onDeletePlacementLabel={onDeletePlacementLabel}
        />
      </section>
    </div>
  )
}
