import { clamp } from '../cad/cad-geometry'
import type { PrintPaper, PrintPlan } from '../preview/print-preview'

type PrintPreviewModalProps = {
  open: boolean
  onClose: () => void
  printPaper: PrintPaper
  onSetPrintPaper: (paper: PrintPaper) => void
  printScalePercent: number
  onSetPrintScalePercent: (scalePercent: number) => void
  printTileX: number
  onSetPrintTileX: (tileX: number) => void
  printTileY: number
  onSetPrintTileY: (tileY: number) => void
  printOverlapMm: number
  onSetPrintOverlapMm: (overlapMm: number) => void
  printMarginMm: number
  onSetPrintMarginMm: (marginMm: number) => void
  printSelectedOnly: boolean
  onSetPrintSelectedOnly: (enabled: boolean) => void
  printRulerInside: boolean
  onSetPrintRulerInside: (enabled: boolean) => void
  printInColor: boolean
  onSetPrintInColor: (enabled: boolean) => void
  printStitchAsDots: boolean
  onSetPrintStitchAsDots: (enabled: boolean) => void
  printPlan: PrintPlan | null
  showPrintAreas: boolean
  onTogglePrintAreas: () => void
  onFitView: () => void
}

export function PrintPreviewModal({
  open,
  onClose,
  printPaper,
  onSetPrintPaper,
  printScalePercent,
  onSetPrintScalePercent,
  printTileX,
  onSetPrintTileX,
  printTileY,
  onSetPrintTileY,
  printOverlapMm,
  onSetPrintOverlapMm,
  printMarginMm,
  onSetPrintMarginMm,
  printSelectedOnly,
  onSetPrintSelectedOnly,
  printRulerInside,
  onSetPrintRulerInside,
  printInColor,
  onSetPrintInColor,
  printStitchAsDots,
  onSetPrintStitchAsDots,
  printPlan,
  showPrintAreas,
  onTogglePrintAreas,
  onFitView,
}: PrintPreviewModalProps) {
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
          <h2>Print Preview + Tiling</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">Matches source-style preview settings: tiling, overlap, calibration scale, selection-only, rulers, and color controls.</p>

        <div className="line-type-edit-grid">
          <label className="field-row">
            <span>Paper</span>
            <select className="action-select" value={printPaper} onChange={(event) => onSetPrintPaper(event.target.value as PrintPaper)}>
              <option value="letter">Letter (216 x 279mm)</option>
              <option value="a4">A4 (210 x 297mm)</option>
            </select>
          </label>
          <label className="field-row">
            <span>Scale (%)</span>
            <input
              type="number"
              min={1}
              max={400}
              value={printScalePercent}
              onChange={(event) => onSetPrintScalePercent(clamp(Number(event.target.value) || 100, 1, 400))}
            />
          </label>
          <label className="field-row">
            <span>Tile X</span>
            <input
              type="number"
              min={1}
              max={25}
              value={printTileX}
              onChange={(event) => onSetPrintTileX(clamp(Number(event.target.value) || 1, 1, 25))}
            />
          </label>
          <label className="field-row">
            <span>Tile Y</span>
            <input
              type="number"
              min={1}
              max={25}
              value={printTileY}
              onChange={(event) => onSetPrintTileY(clamp(Number(event.target.value) || 1, 1, 25))}
            />
          </label>
          <label className="field-row">
            <span>Overlap (mm)</span>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={printOverlapMm}
              onChange={(event) => onSetPrintOverlapMm(clamp(Number(event.target.value) || 0, 0, 30))}
            />
          </label>
          <label className="field-row">
            <span>Margin (mm)</span>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={printMarginMm}
              onChange={(event) => onSetPrintMarginMm(clamp(Number(event.target.value) || 0, 0, 30))}
            />
          </label>
        </div>

        <div className="control-block">
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printSelectedOnly} onChange={(event) => onSetPrintSelectedOnly(event.target.checked)} />
            <span>Print selected shapes only</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printRulerInside} onChange={(event) => onSetPrintRulerInside(event.target.checked)} />
            <span>Ruler inside page</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printInColor} onChange={(event) => onSetPrintInColor(event.target.checked)} />
            <span>Print in color</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printStitchAsDots} onChange={(event) => onSetPrintStitchAsDots(event.target.checked)} />
            <span>Render stitch holes as dots</span>
          </label>
        </div>

        {printPlan ? (
          <div className="print-preview-summary">
            <div>
              Source bounds: {printPlan.sourceBounds.width} x {printPlan.sourceBounds.height} mm
            </div>
            <div>
              Coverage: {printPlan.contentWidthMm} x {printPlan.contentHeightMm} mm
            </div>
            <div>Pages: {printPlan.tiles.length}</div>
            <div>
              Color: {printInColor ? 'On' : 'Off'} | Ruler: {printRulerInside ? 'Inside' : 'Outside'}
            </div>
          </div>
        ) : (
          <p className="hint">No shapes available for print preview with current filters.</p>
        )}

        <div className="line-type-modal-actions">
          <button onClick={onTogglePrintAreas}>{showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas'}</button>
          <button onClick={onFitView}>Fit to Content</button>
        </div>
      </div>
    </div>
  )
}
