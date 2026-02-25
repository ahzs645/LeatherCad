import type { LineType, LineTypeRole, LineTypeStyle } from '../cad-types'

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

const ROLE_OPTIONS: Array<{ value: LineTypeRole; label: string }> = [
  { value: 'cut', label: 'Cut' },
  { value: 'stitch', label: 'Stitch' },
  { value: 'fold', label: 'Fold' },
  { value: 'guide', label: 'Guide' },
  { value: 'mark', label: 'Mark' },
]

const STYLE_OPTIONS: Array<{ value: LineTypeStyle; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

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

        <p className="hint">
          Select shapes on canvas with Move tool (Shift+tap/click for multi-select), then assign line type.
        </p>

        <div className="line-type-modal-actions">
          <button onClick={onShowAllTypes}>Show All Types</button>
          <button onClick={onIsolateActiveType} disabled={!activeLineType}>
            Isolate Active Type
          </button>
        </div>

        <div className="line-type-modal-list">
          {lineTypes.map((lineType) => (
            <button
              key={lineType.id}
              className={`line-type-chip ${activeLineType?.id === lineType.id ? 'active' : ''}`}
              onClick={() => onSetActiveLineTypeId(lineType.id)}
            >
              <span className="line-type-chip-swatch" style={{ backgroundColor: lineType.color }} />
              <span className="line-type-chip-label">{lineType.name}</span>
              <span className="line-type-chip-meta">{`${shapeCountsByLineType[lineType.id] ?? 0}`}</span>
              <span className="line-type-chip-meta">{lineType.visible ? 'visible' : 'hidden'}</span>
            </button>
          ))}
        </div>

        {activeLineType && (
          <div className="line-type-edit-grid">
            <label className="field-row">
              <span>Active type</span>
              <input value={activeLineType.name} readOnly />
            </label>

            <label className="field-row">
              <span>Role</span>
              <select
                className="action-select"
                value={activeLineType.role}
                onChange={(event) => onUpdateActiveLineTypeRole(event.target.value as LineTypeRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-row">
              <span>Style</span>
              <select
                className="action-select"
                value={activeLineType.style}
                onChange={(event) => onUpdateActiveLineTypeStyle(event.target.value as LineTypeStyle)}
              >
                {STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-row">
              <span>Color</span>
              <input type="color" value={activeLineType.color} onChange={(event) => onUpdateActiveLineTypeColor(event.target.value)} />
            </label>
          </div>
        )}

        <div className="line-type-modal-actions">
          <button
            onClick={() => {
              if (activeLineType) {
                onToggleLineTypeVisibility(activeLineType.id)
              }
            }}
            disabled={!activeLineType}
          >
            {activeLineType?.visible ? 'Hide Active Type' : 'Show Active Type'}
          </button>
          <button onClick={onSelectShapesByActiveType} disabled={!activeLineType}>
            Select Shapes By Active Type
          </button>
        </div>

        <div className="line-type-modal-actions">
          <button onClick={onAssignSelectedToActiveType} disabled={!activeLineType || selectedShapeCount === 0}>
            Assign Selected To Active Type
          </button>
          <button onClick={onClearSelection} disabled={selectedShapeCount === 0}>
            Clear Selection ({selectedShapeCount})
          </button>
        </div>
      </div>
    </div>
  )
}

