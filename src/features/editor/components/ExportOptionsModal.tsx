import { useTranslate } from '../hooks/useTranslate'
import type { LineTypeRole } from '../cad/cad-types'
import type { DxfVersion, ExportRoleFilters, StitchHoleExportRenderMode } from '../editor-types'

type ExportOptionsModalProps = {
  open: boolean
  onClose: () => void
  activeExportRoleCount: number
  exportOnlySelectedShapes: boolean
  exportOnlyVisibleLineTypes: boolean
  exportForceSolidStrokes: boolean
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  exportStitchHoleRenderMode: StitchHoleExportRenderMode
  exportStitchDotRadiusMm: number
  exportRoleFilters: ExportRoleFilters
  dxfVersion: DxfVersion
  dxfFlipY: boolean
  onExportOnlySelectedShapesChange: (enabled: boolean) => void
  onExportOnlyVisibleLineTypesChange: (enabled: boolean) => void
  onExportForceSolidStrokesChange: (enabled: boolean) => void
  onExportIncludeTextChange: (enabled: boolean) => void
  onExportIncludeTemplateMetadataChange: (enabled: boolean) => void
  onExportStitchHoleRenderModeChange: (mode: StitchHoleExportRenderMode) => void
  onExportStitchDotRadiusMmChange: (value: number) => void
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
  exportIncludeText,
  exportIncludeTemplateMetadata,
  exportStitchHoleRenderMode,
  exportStitchDotRadiusMm,
  exportRoleFilters,
  dxfVersion,
  dxfFlipY,
  onExportOnlySelectedShapesChange,
  onExportOnlyVisibleLineTypesChange,
  onExportForceSolidStrokesChange,
  onExportIncludeTextChange,
  onExportIncludeTemplateMetadataChange,
  onExportStitchHoleRenderModeChange,
  onExportStitchDotRadiusMmChange,
  onExportRoleFilterChange,
  onDxfVersionChange,
  onDxfFlipYChange,
  onResetDefaults,
}: ExportOptionsModalProps) {
  const t = useTranslate()
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
          <h2>{t('Export Options')}</h2>
          <button onClick={onClose}>{t('Done')}</button>
        </div>

        <p className="hint">{t('Applies to SVG, PDF, and DXF exports.')}</p>

        <div className="control-block">
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportOnlySelectedShapes}
              onChange={(event) => onExportOnlySelectedShapesChange(event.target.checked)}
            />
            <span>{t('Export only selected shapes')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportOnlyVisibleLineTypes}
              onChange={(event) => onExportOnlyVisibleLineTypesChange(event.target.checked)}
            />
            <span>{t('Export only visible line types')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportForceSolidStrokes}
              onChange={(event) => onExportForceSolidStrokesChange(event.target.checked)}
            />
            <span>{t('Convert dashed/dotted/dash-dot-dot to solid on export')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeText}
              onChange={(event) => onExportIncludeTextChange(event.target.checked)}
            />
            <span>{t('Include text shapes')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeTemplateMetadata}
              onChange={(event) => onExportIncludeTemplateMetadataChange(event.target.checked)}
            />
            <span>{t('Include template / painted parts')}</span>
          </label>
        </div>

        <div className="control-block">
          <h3>{t('Stitch Holes')}</h3>
          <label className="field-row">
            <span>{t('Render Mode')}</span>
            <select
              className="action-select"
              value={exportStitchHoleRenderMode}
              onChange={(event) => onExportStitchHoleRenderModeChange(event.target.value as StitchHoleExportRenderMode)}
            >
              <option value="native">{t('Native geometry')}</option>
              <option value="dots">{t('Dots')}</option>
              <option value="single-lines">{t('Single lines')}</option>
            </select>
          </label>
          <label className="field-row">
            <span>{t('Dot Radius (mm)')}</span>
            <input
              type="number"
              min={0.2}
              max={10}
              step={0.1}
              value={exportStitchDotRadiusMm}
              onChange={(event) => onExportStitchDotRadiusMmChange(Math.max(0.2, Number(event.target.value) || 0.2))}
            />
          </label>
        </div>

        <div className="control-block">
          <h3>{t('Line Type Roles (')}{activeExportRoleCount} {t('enabled)')}</h3>
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
          <h3>{t('DXF')}</h3>
          <label className="field-row">
            <span>{t('Version')}</span>
            <select className="action-select" value={dxfVersion} onChange={(event) => onDxfVersionChange(event.target.value as DxfVersion)}>
              <option value="r12">{t('R12 (AC1009)')}</option>
              <option value="r14">{t('R14 (AC1014)')}</option>
              <option value="r2004">{t('R2004 (RGB colors and lineweights)')}</option>
            </select>
          </label>
          {dxfVersion !== 'r2004' && <p role="status">{t('R12/R14 use indexed colors and omit lineweights. Choose R2004 to retain RGB colors and lineweights.')}</p>}
          <label className="layer-toggle-item">
            <input type="checkbox" checked={dxfFlipY} onChange={(event) => onDxfFlipYChange(event.target.checked)} />
            <span>{t('Use CAD Y-up coordinates (recommended)')}</span>
          </label>
        </div>

        <div className="line-type-modal-actions">
          <button onClick={onResetDefaults}>{t('Reset Export Defaults')}</button>
        </div>
      </div>
    </div>
  )
}
