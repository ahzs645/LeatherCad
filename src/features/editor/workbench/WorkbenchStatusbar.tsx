import { useTranslate } from '../hooks/useTranslate'
import { requestCanvasView } from '../ops/editor-events'
import { useOptionalEditorDocumentApi } from '../state/providers/EditorDocumentStateProvider'
import { useOptionalEditorUIApi } from '../state/providers/EditorUIStateProvider'

type WorkbenchStatusbarProps = {
  toolLabel: string
  selectionText: string
  zoomPercent: number
  displayUnit: 'mm' | 'in'
  activeLayerName: string
  activeLineTypeName: string
  statusText?: string
  onTogglePrecision: () => void
}

/**
 * Status bar. Inside the editor, zoom, unit, snap and grid are clickable as in
 * the reference editor: zoom returns to 100%, the unit toggles mm/inch (N),
 * snap and grid toggle (G).
 */
export function WorkbenchStatusbar({
  toolLabel,
  selectionText,
  zoomPercent,
  displayUnit,
  activeLayerName,
  activeLineTypeName,
  statusText,
  onTogglePrecision,
}: WorkbenchStatusbarProps) {
  const t = useTranslate()
  const ui = useOptionalEditorUIApi()
  const documentApi = useOptionalEditorDocumentApi()
  const snapEnabled = documentApi?.state.snapSettings.enabled
  const showGrid = ui?.state.showGrid
  return (
    <footer className="workbench-statusbar">
      <span>{`${t('Tool')} ${t(toolLabel)}`}</span>
      <span>{selectionText === 'No selection' ? t(selectionText) : selectionText}</span>
      {ui ? (
        <button type="button" className="statusbar-toggle" title={t('Click to go back to 100%')} onClick={() => requestCanvasView('reset')}>
          {`${zoomPercent}%`}
        </button>
      ) : <span>{`${zoomPercent}%`}</span>}
      {ui ? (
        <button
          type="button"
          className="statusbar-toggle"
          data-testid="statusbar-unit"
          title={t('Click to toggle unit (N)')}
          onClick={() => ui.actions.setDisplayUnit(displayUnit === 'mm' ? 'in' : 'mm')}
        >
          {displayUnit}
        </button>
      ) : <span>{displayUnit}</span>}
      {documentApi && typeof snapEnabled === 'boolean' && (
        <button
          type="button"
          className={`statusbar-toggle ${snapEnabled ? 'is-on' : 'is-off'}`}
          data-testid="statusbar-snap"
          aria-pressed={snapEnabled}
          title={t('Click to toggle snapping')}
          onClick={() => documentApi.actions.setSnapSettings((previous) => ({ ...previous, enabled: !previous.enabled }))}
        >
          {snapEnabled ? t('SNAP ON') : t('SNAP OFF')}
        </button>
      )}
      {ui && typeof showGrid === 'boolean' && (
        <button
          type="button"
          className={`statusbar-toggle ${showGrid ? 'is-on' : 'is-off'}`}
          data-testid="statusbar-grid"
          aria-pressed={showGrid}
          title={t('Click to toggle the grid (G)')}
          onClick={() => ui.actions.setShowGrid((previous) => !previous)}
        >
          {showGrid ? t('GRID ON') : t('GRID OFF')}
        </button>
      )}
      <span>{`${t('Layer')} ${activeLayerName}`}</span>
      <span>{`${t('Type')} ${activeLineTypeName}`}</span>
      {statusText && (
        <span
          className="workbench-status-message"
          role="status"
          aria-live="polite"
          title={t(statusText)}
          style={{ minWidth: 0, maxWidth: '45vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {t(statusText)}
        </span>
      )}
      <button type="button" data-testid="statusbar-precision" onClick={onTogglePrecision}>
        {t('Precision')}
      </button>
    </footer>
  )
}
