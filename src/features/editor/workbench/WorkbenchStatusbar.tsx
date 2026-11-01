import { useTranslate } from '../hooks/useTranslate'
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
  return (
    <footer className="workbench-statusbar">
      <span>{`${t('Tool')} ${t(toolLabel)}`}</span>
      <span>{selectionText === 'No selection' ? t(selectionText) : selectionText}</span>
      <span>{`${zoomPercent}%`}</span>
      <span>{displayUnit}</span>
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
