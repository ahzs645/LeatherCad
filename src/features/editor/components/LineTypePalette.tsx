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
  onUpdateActiveLineTypeIgnoreInPrint: (ignoreInPrint: boolean) => void
  onUpdateActiveLineTypeRole: (role: LineTypeRole) => void
  onUpdateActiveLineTypeStyle: (style: LineTypeStyle) => void
  onUpdateActiveLineTypeStrokeWidthMm: (strokeWidthMm: number) => void
  onSelectAllOnVisibleLineTypes: () => void
  onUnselectActiveLineType: () => void
  onUnselectOtherLineTypes: () => void
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
  onUpdateActiveLineTypeIgnoreInPrint,
  onUpdateActiveLineTypeRole,
  onUpdateActiveLineTypeStyle,
  onUpdateActiveLineTypeStrokeWidthMm,
  onSelectAllOnVisibleLineTypes,
  onUnselectActiveLineType,
  onUnselectOtherLineTypes,
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

        <div className="line-type-palette-selection-actions">
          <button onClick={onSelectAllOnVisibleLineTypes}>
            Select all on visible line types
          </button>
          <button onClick={onUnselectActiveLineType} disabled={!activeLineType}>
            Deselect active line type
          </button>
          <button onClick={onUnselectOtherLineTypes} disabled={!activeLineType}>
            Keep only active line type
          </button>
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
          onUpdateActiveLineTypeIgnoreInPrint={onUpdateActiveLineTypeIgnoreInPrint}
          onUpdateActiveLineTypeRole={onUpdateActiveLineTypeRole}
          onUpdateActiveLineTypeStyle={onUpdateActiveLineTypeStyle}
          onUpdateActiveLineTypeStrokeWidthMm={onUpdateActiveLineTypeStrokeWidthMm}
        />
      </div>
    </div>
  )
}
