import { useTranslate } from '../hooks/useTranslate'
import { clamp } from '../cad/cad-geometry'
import {
  resolvePrintCalibrationDpi,
  type PrintOrientation,
  type PrintPaper,
  type PrintPlan,
} from '../preview/print-preview'

type PrintPreviewModalProps = {
  open: boolean
  onClose: () => void
  printPaper: PrintPaper
  onSetPrintPaper: (paper: PrintPaper) => void
  printOrientation: PrintOrientation
  onSetPrintOrientation: (orientation: PrintOrientation) => void
  printIntoMargin: boolean
  onSetPrintIntoMargin: (enabled: boolean) => void
  printScalePercent: number
  onSetPrintScalePercent: (scalePercent: number) => void
  printCalibrationXPercent: number
  onSetPrintCalibrationXPercent: (scalePercent: number) => void
  printCalibrationYPercent: number
  onSetPrintCalibrationYPercent: (scalePercent: number) => void
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
  printRulerAnchorTileIndex: number | null
  onSetPrintRulerAnchorTileIndex: (tileIndex: number | null) => void
  printInColor: boolean
  onSetPrintInColor: (enabled: boolean) => void
  printStitchAsDots: boolean
  onSetPrintStitchAsDots: (enabled: boolean) => void
  printLineThicknessScalePercent: number
  onSetPrintLineThicknessScalePercent: (scalePercent: number) => void
  printShowIgnoredLineTypes: boolean
  onSetPrintShowIgnoredLineTypes: (enabled: boolean) => void
  printPlan: PrintPlan | null
  showPrintAreas: boolean
  onTogglePrintAreas: () => void
  onFitView: () => void
  onOpenPrintTiles: () => void
}

export function PrintPreviewModal({
  open,
  onClose,
  printPaper,
  onSetPrintPaper,
  printOrientation,
  onSetPrintOrientation,
  printIntoMargin,
  onSetPrintIntoMargin,
  printScalePercent,
  onSetPrintScalePercent,
  printCalibrationXPercent,
  onSetPrintCalibrationXPercent,
  printCalibrationYPercent,
  onSetPrintCalibrationYPercent,
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
  printRulerAnchorTileIndex,
  onSetPrintRulerAnchorTileIndex,
  printInColor,
  onSetPrintInColor,
  printStitchAsDots,
  onSetPrintStitchAsDots,
  printLineThicknessScalePercent,
  onSetPrintLineThicknessScalePercent,
  printShowIgnoredLineTypes,
  onSetPrintShowIgnoredLineTypes,
  printPlan,
  showPrintAreas,
  onTogglePrintAreas,
  onFitView,
  onOpenPrintTiles,
}: PrintPreviewModalProps) {
  const t = useTranslate()
  if (!open) {
    return null
  }

  const activeDpiX = resolvePrintCalibrationDpi(printOrientation === 'landscape' ? printCalibrationYPercent : printCalibrationXPercent)
  const activeDpiY = resolvePrintCalibrationDpi(printOrientation === 'landscape' ? printCalibrationXPercent : printCalibrationYPercent)

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
      <div className="export-options-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="print-preview-title">
        <div className="layer-color-modal-header">
          <h2 id="print-preview-title">{t('Print Preview + Tiling')}</h2>
          <button onClick={onClose}>{t('Done')}</button>
        </div>
        <p className="hint">{t('Matches source-style preview settings: tiling, overlap, calibration scale, selection-only, rulers, and color controls.')}</p>

        <div className="line-type-edit-grid">
          <label className="field-row">
            <span>{t('Paper')}</span>
            <select aria-label={t('Paper')} className="action-select" value={printPaper} onChange={(event) => onSetPrintPaper(event.target.value as PrintPaper)}>
              <option value="letter">{t('Letter (215.9 x 279.4mm)')}</option>
              <option value="a4">{t('A4 (210 x 297mm)')}</option>
            </select>
          </label>
          <label className="field-row">
            <span>{t('Orientation')}</span>
            <select
              aria-label={t('Orientation')}
              className="action-select"
              value={printOrientation}
              onChange={(event) => onSetPrintOrientation(event.target.value as PrintOrientation)}
            >
              <option value="portrait">{t('Portrait')}</option>
              <option value="landscape">{t('Landscape (auto-flips calibration X/Y)')}</option>
            </select>
          </label>
          <label className="field-row">
            <span>{t('Scale (%)')}</span>
            <input
              type="number"
              min={1}
              max={400}
              value={printScalePercent}
              onChange={(event) => onSetPrintScalePercent(clamp(Number(event.target.value) || 100, 1, 400))}
            />
          </label>
          <label className="field-row">
            <span>{t('Calibration X (%)')}</span>
            <input
              type="number"
              min={50}
              max={200}
              step={0.1}
              value={printCalibrationXPercent}
              onChange={(event) => onSetPrintCalibrationXPercent(clamp(Number(event.target.value) || 100, 50, 200))}
            />
          </label>
          <label className="field-row">
            <span>{t('Calibration Y (%)')}</span>
            <input
              type="number"
              min={50}
              max={200}
              step={0.1}
              value={printCalibrationYPercent}
              onChange={(event) => onSetPrintCalibrationYPercent(clamp(Number(event.target.value) || 100, 50, 200))}
            />
          </label>
          <label className="field-row">
            <span>{t('Tile X')}</span>
            <input
              type="number"
              min={1}
              max={25}
              value={printTileX}
              onChange={(event) => onSetPrintTileX(clamp(Number(event.target.value) || 1, 1, 25))}
            />
          </label>
          <div className="field-row">
            <span>{t('Pages X')}</span>
            <div className="line-type-modal-actions">
              <button type="button" onClick={() => onSetPrintTileX(clamp(printTileX - 1, 1, 25))} disabled={printTileX <= 1}>
                {t('Remove')}
              </button>
              <button type="button" onClick={() => onSetPrintTileX(clamp(printTileX + 1, 1, 25))}>
                {t('Add')}
              </button>
            </div>
          </div>
          <label className="field-row">
            <span>{t('Tile Y')}</span>
            <input
              type="number"
              min={1}
              max={25}
              value={printTileY}
              onChange={(event) => onSetPrintTileY(clamp(Number(event.target.value) || 1, 1, 25))}
            />
          </label>
          <div className="field-row">
            <span>{t('Pages Y')}</span>
            <div className="line-type-modal-actions">
              <button type="button" onClick={() => onSetPrintTileY(clamp(printTileY - 1, 1, 25))} disabled={printTileY <= 1}>
                {t('Remove')}
              </button>
              <button type="button" onClick={() => onSetPrintTileY(clamp(printTileY + 1, 1, 25))}>
                {t('Add')}
              </button>
            </div>
          </div>
          <label className="field-row">
            <span>{t('Overlap (mm)')}</span>
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
            <span>{t('Margin (mm)')}</span>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={printMarginMm}
              disabled={printIntoMargin}
              onChange={(event) => onSetPrintMarginMm(clamp(Number(event.target.value) || 0, 0, 30))}
            />
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={printIntoMargin}
              onChange={(event) => onSetPrintIntoMargin(event.target.checked)}
            />
            <span>{t('Print into margin (treat the gutter as printable area)')}</span>
          </label>
        </div>

        <div className="control-block">
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printSelectedOnly} onChange={(event) => onSetPrintSelectedOnly(event.target.checked)} />
            <span>{t('Print selected shapes only')}</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printRulerInside} onChange={(event) => onSetPrintRulerInside(event.target.checked)} />
            <span>{t('Ruler inside page')}</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printInColor} onChange={(event) => onSetPrintInColor(event.target.checked)} />
            <span>{t('Print in color')}</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={printStitchAsDots} onChange={(event) => onSetPrintStitchAsDots(event.target.checked)} />
            <span>{t('Render stitch holes as dots')}</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={printShowIgnoredLineTypes}
              onChange={(event) => onSetPrintShowIgnoredLineTypes(event.target.checked)}
            />
            <span>{t('Show non-print line types')}</span>
          </label>
          <label className="field-row">
            <span>{t('Line thickness (%)')}</span>
            <input
              type="number"
              min={5}
              max={400}
              step={5}
              value={printLineThicknessScalePercent}
              onChange={(event) =>
                onSetPrintLineThicknessScalePercent(clamp(Number(event.target.value) || 100, 5, 400))
              }
            />
          </label>
        </div>

        {printPlan ? (
          <div className="print-preview-summary">
            <div>
              {t('print.sourceBounds', 'Source bounds: {width} × {height} mm').replace('{width}', String(printPlan.sourceBounds.width)).replace('{height}', String(printPlan.sourceBounds.height))}
            </div>
            <div>
              {t('print.coverage', 'Coverage: {width} × {height} mm').replace('{width}', String(printPlan.contentWidthMm)).replace('{height}', String(printPlan.contentHeightMm))}
            </div>
            <div>{t('print.pages', 'Pages: {count}').replace('{count}', String(printPlan.tiles.length))}</div>
            {(printPlan.sourceBounds.width * printPlan.effectiveScaleX > printPlan.contentWidthMm + 0.001 ||
              printPlan.sourceBounds.height * printPlan.effectiveScaleY > printPlan.contentHeightMm + 0.001) && (
              <p role="status">{t('The drawing exceeds these pages at this scale. Increase the tile count to print the complete pattern.')}</p>
            )}
            {printRulerInside && printPlan.tiles.length > 1 && (
              <div className="print-preview-tile-grid">
                <span className="hint">{t('Anchor the 100mm XY ruler on which page?')}</span>
                <div className="print-preview-tile-grid-cells">
                  <button
                    type="button"
                    className={printRulerAnchorTileIndex === null ? 'active' : ''}
                    onClick={() => onSetPrintRulerAnchorTileIndex(null)}
                  >
                    {t('Auto')}
                  </button>
                  {printPlan.tiles.map((_, tileIndex) => (
                    <button
                      key={tileIndex}
                      type="button"
                      className={printRulerAnchorTileIndex === tileIndex ? 'active' : ''}
                      onClick={() => onSetPrintRulerAnchorTileIndex(tileIndex)}
                      title={t('print.rulerTile', 'Place the ruler on tile {count}').replace('{count}', String(tileIndex + 1))}
                    >
                      {t('print.page', 'Page {count}').replace('{count}', String(tileIndex + 1))}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              {t('print.activeDpi', 'Active DPI: {x} × {y}').replace('{x}', String(activeDpiX)).replace('{y}', String(activeDpiY))}
            </div>
            <div>
              {t('print.colorRuler', 'Color: {color} | Ruler: {ruler}').replace('{color}', t(printInColor ? 'On' : 'Off')).replace('{ruler}', t(printRulerInside ? 'Inside' : 'Outside'))}
            </div>
            <div>
              {t('print.lineSummary', 'Line thickness: {percent}% | Non-print lines: {visibility}').replace('{percent}', String(printLineThicknessScalePercent)).replace('{visibility}', t(printShowIgnoredLineTypes ? 'Shown' : 'Hidden'))}
            </div>
          </div>
        ) : (
          <p className="hint">{t('No shapes available for print preview with current filters.')}</p>
        )}

        <div className="line-type-modal-actions">
          <button onClick={onTogglePrintAreas}>{t(showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas')}</button>
          <button onClick={onOpenPrintTiles} disabled={!printPlan}>
            {t('Open Printable Tiles')}
          </button>
          <button onClick={onFitView}>{t('Fit to Content')}</button>
        </div>
      </div>
    </div>
  )
}
