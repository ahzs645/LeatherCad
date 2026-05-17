import { useState } from 'react'
import type { LineType, LineTypeRole, LineTypeStyle } from '../cad/cad-types'
import { resolveLineTypeStrokeWidthMm, shouldIgnoreLineTypeInPrint } from '../cad/line-types'
import { CanvasContextMenu, type ContextMenuItem } from './CanvasContextMenu'

type LineTypeManagerSectionProps = {
  activeLineType: LineType | null
  lineTypes: LineType[]
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  onAssignSelectedToActiveType: () => void
  onClearSelection: () => void
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
  { value: 'dash-dot-dot', label: 'Dash Dot Dot' },
]

export function LineTypeManagerSection({
  activeLineType,
  lineTypes,
  shapeCountsByLineType,
  selectedShapeCount,
  onAssignSelectedToActiveType,
  onClearSelection,
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
}: LineTypeManagerSectionProps) {
  const [contextMenu, setContextMenu] = useState<{ lineTypeId: string; x: number; y: number } | null>(null)

  const contextTarget = contextMenu ? lineTypes.find((entry) => entry.id === contextMenu.lineTypeId) ?? null : null
  const contextItems: ContextMenuItem[] = contextTarget
    ? [
        {
          id: 'set-active',
          label: `Set as Active (${contextTarget.name})`,
          onSelect: () => onSetActiveLineTypeId(contextTarget.id),
        },
        {
          id: 'toggle-visibility',
          label: contextTarget.visible ? 'Hide' : 'Show',
          onSelect: () => onToggleLineTypeVisibility(contextTarget.id),
        },
        {
          id: 'show-only',
          label: 'Show Only This',
          onSelect: () => {
            onSetActiveLineTypeId(contextTarget.id)
            onIsolateActiveType()
          },
        },
        {
          id: 'show-all',
          label: 'Show All Types',
          onSelect: () => onShowAllTypes(),
        },
        {
          id: 'select-shapes',
          label: 'Select Shapes Of This Type',
          onSelect: () => {
            onSetActiveLineTypeId(contextTarget.id)
            onSelectShapesByActiveType()
          },
        },
      ]
    : []

  return (
    <>
      <p className="hint">Select shapes on canvas with Move tool, then assign or inspect line types here.</p>

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
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ lineTypeId: lineType.id, x: event.clientX, y: event.clientY })
            }}
          >
            <span className="line-type-chip-swatch" style={{ backgroundColor: lineType.color }} />
            <span className="line-type-chip-label">{lineType.name}</span>
            <span className="line-type-chip-meta">{`${shapeCountsByLineType[lineType.id] ?? 0}`}</span>
            <span className="line-type-chip-meta">{lineType.visible ? 'visible' : 'hidden'}</span>
            {shouldIgnoreLineTypeInPrint(lineType) && <span className="line-type-chip-meta">no print</span>}
          </button>
        ))}
      </div>

      <CanvasContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        items={contextItems}
        onClose={() => setContextMenu(null)}
      />

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
            <input
              type="color"
              value={activeLineType.color}
              onChange={(event) => onUpdateActiveLineTypeColor(event.target.value)}
            />
            <input
              type="text"
              value={activeLineType.color}
              onChange={(event) => onUpdateActiveLineTypeColor(event.target.value)}
              placeholder="#000000"
              pattern="#[0-9a-fA-F]{6}"
              style={{ width: 96 }}
              aria-label="Line type color (hex)"
            />
          </label>

          <label className="field-row">
            <span>Thickness</span>
            <input
              type="number"
              min={0.1}
              max={20}
              step={0.1}
              value={resolveLineTypeStrokeWidthMm(activeLineType)}
              onChange={(event) => onUpdateActiveLineTypeStrokeWidthMm(Number(event.target.value))}
              aria-label="Line type thickness in millimeters"
            />
          </label>

          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={shouldIgnoreLineTypeInPrint(activeLineType)}
              onChange={(event) => onUpdateActiveLineTypeIgnoreInPrint(event.target.checked)}
            />
            <span>Ignore in print</span>
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
    </>
  )
}
