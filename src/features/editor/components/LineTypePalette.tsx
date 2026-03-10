import type { LineType, LineTypeRole, LineTypeStyle } from '../cad/cad-types'
import { LineTypeManagerSection } from './LineTypeManagerSection'

type LineTypePaletteProps = {
  activeLineType: LineType | null
  lineTypes: LineType[]
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  onAssignSelectedToActiveType: () => void
  onClearSelection: () => void
  onClose: () => void
  onIsolateActiveType: () => void
  onSelectShapesByActiveType: () => void
  onSetActiveLineTypeId: (lineTypeId: string) => void
  onShowAllTypes: () => void
  onToggleLineTypeVisibility: (lineTypeId: string) => void
  onUpdateActiveLineTypeColor: (color: string) => void
  onUpdateActiveLineTypeRole: (role: LineTypeRole) => void
  onUpdateActiveLineTypeStyle: (style: LineTypeStyle) => void
  open: boolean
}

export function LineTypePalette({
  activeLineType,
  lineTypes,
  shapeCountsByLineType,
  selectedShapeCount,
  onAssignSelectedToActiveType,
  onClearSelection,
  onClose,
  onIsolateActiveType,
  onSelectShapesByActiveType,
  onSetActiveLineTypeId,
  onShowAllTypes,
  onToggleLineTypeVisibility,
  onUpdateActiveLineTypeColor,
  onUpdateActiveLineTypeRole,
  onUpdateActiveLineTypeStyle,
  open,
}: LineTypePaletteProps) {
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
      <div className="line-type-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="line-type-modal-header">
          <h2>Line Type Palette</h2>
          <button onClick={onClose}>Done</button>
        </div>

        <LineTypeManagerSection
          activeLineType={activeLineType}
          lineTypes={lineTypes}
          shapeCountsByLineType={shapeCountsByLineType}
          selectedShapeCount={selectedShapeCount}
          onAssignSelectedToActiveType={onAssignSelectedToActiveType}
          onClearSelection={onClearSelection}
          onIsolateActiveType={onIsolateActiveType}
          onSelectShapesByActiveType={onSelectShapesByActiveType}
          onSetActiveLineTypeId={onSetActiveLineTypeId}
          onShowAllTypes={onShowAllTypes}
          onToggleLineTypeVisibility={onToggleLineTypeVisibility}
          onUpdateActiveLineTypeColor={onUpdateActiveLineTypeColor}
          onUpdateActiveLineTypeRole={onUpdateActiveLineTypeRole}
          onUpdateActiveLineTypeStyle={onUpdateActiveLineTypeStyle}
        />
      </div>
    </div>
  )
}
