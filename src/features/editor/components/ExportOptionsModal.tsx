import type { LineTypeRole } from '../cad/cad-types'
import type { DxfVersion, ExportRoleFilters } from '../editor-types'

type ExportOptionsModalProps = {
  open: boolean
  onClose: () => void
  activeExportRoleCount: number
  exportOnlySelectedShapes: boolean
  exportOnlyVisibleLineTypes: boolean
  exportForceSolidStrokes: boolean
  exportRoleFilters: ExportRoleFilters
  dxfVersion: DxfVersion
  dxfFlipY: boolean
  onExportOnlySelectedShapesChange: (enabled: boolean) => void
  onExportOnlyVisibleLineTypesChange: (enabled: boolean) => void
  onExportForceSolidStrokesChange: (enabled: boolean) => void
  onExportRoleFilterChange: (role: LineTypeRole, enabled: boolean) => void
  onDxfVersionChange: (version: DxfVersion) => void
  onDxfFlipYChange: (enabled: boolean) => void
  onResetDefaults: () => void
}

const EXPORT_ROLES: LineTypeRole[] = ['cut', 'stitch', 'fold', 'guide', 'mark']

export function ExportOptionsModal({
  open,
  onClose,
  activeExportRoleCount,
  exportOnlySelectedShapes,
  exportOnlyVisibleLineTypes,
  exportForceSolidStrokes,
  exportRoleFilters,
  dxfVersion,
  dxfFlipY,
  onExportOnlySelectedShapesChange,
  onExportOnlyVisibleLineTypesChange,
  onExportForceSolidStrokesChange,
  onExportRoleFilterChange,
  onDxfVersionChange,
  onDxfFlipYChange,
  onResetDefaults,
}: ExportOptionsModalProps) {
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
      <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="layer-color-modal-header">
          <h2>Export Options</h2>
          <button onClick={onClose}>Done</button>
        </div>

        <p className="hint">Applies to SVG, PDF, and DXF exports.</p>

        <div className="control-block">
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportOnlySelectedShapes}
              onChange={(event) => onExportOnlySelectedShapesChange(event.target.checked)}
            />
            <span>Export only selected shapes</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportOnlyVisibleLineTypes}
              onChange={(event) => onExportOnlyVisibleLineTypesChange(event.target.checked)}
            />
            <span>Export only visible line types</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportForceSolidStrokes}
              onChange={(event) => onExportForceSolidStrokesChange(event.target.checked)}
            />
            <span>Convert dashed/dotted to solid on export</span>
          </label>
        </div>

        <div className="control-block">
          <h3>Line Type Roles ({activeExportRoleCount} enabled)</h3>
          <div className="export-role-grid">
            {EXPORT_ROLES.map((role) => (
              <label key={role} className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={exportRoleFilters[role]}
                  onChange={(event) => onExportRoleFilterChange(role, event.target.checked)}
                />
                <span>{role[0].toUpperCase() + role.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="control-block">
          <h3>DXF</h3>
          <label className="field-row">
            <span>Version</span>
            <select className="action-select" value={dxfVersion} onChange={(event) => onDxfVersionChange(event.target.value as DxfVersion)}>
              <option value="r12">R12 (AC1009)</option>
              <option value="r14">R14 (AC1014)</option>
            </select>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={dxfFlipY} onChange={(event) => onDxfFlipYChange(event.target.checked)} />
            <span>Flip Y axis on DXF export</span>
          </label>
        </div>

        <div className="line-type-modal-actions">
          <button onClick={onResetDefaults}>Reset Export Defaults</button>
        </div>
      </div>
    </div>
  )
}
