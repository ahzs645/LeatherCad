type WorkbenchStatusbarProps = {
  toolLabel: string
  selectionText: string
  zoomPercent: number
  displayUnit: 'mm' | 'in'
  activeLayerName: string
  activeLineTypeName: string
  onTogglePrecision: () => void
}

export function WorkbenchStatusbar({
  toolLabel,
  selectionText,
  zoomPercent,
  displayUnit,
  activeLayerName,
  activeLineTypeName,
  onTogglePrecision,
}: WorkbenchStatusbarProps) {
  return (
    <footer className="workbench-statusbar">
      <span>{`Tool ${toolLabel}`}</span>
      <span>{selectionText}</span>
      <span>{`${zoomPercent}%`}</span>
      <span>{displayUnit}</span>
      <span>{`Layer ${activeLayerName}`}</span>
      <span>{`Type ${activeLineTypeName}`}</span>
      <button type="button" data-testid="statusbar-precision" onClick={onTogglePrecision}>
        Precision
      </button>
    </footer>
  )
}
