import type { Layer } from '../cad/cad-types'
import type { LegendMode } from '../editor-types'

type StackLegendEntry = {
  stackLevel: number
  layerNames: string[]
  swatchBackground: string
}

type LayerLegendPanelProps = {
  show: boolean
  legendMode: LegendMode
  onSetLegendMode: (mode: LegendMode) => void
  layers: Layer[]
  layerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stackLegendEntries: StackLegendEntry[]
  cutStrokeColor: string
  stitchStrokeColor: string
  foldStrokeColor: string
}

export function LayerLegendPanel({
  show,
  legendMode,
  onSetLegendMode,
  layers,
  layerColorsById,
  fallbackLayerStroke,
  stackLegendEntries,
  cutStrokeColor,
  stitchStrokeColor,
  foldStrokeColor,
}: LayerLegendPanelProps) {
  if (!show) {
    return null
  }

  return (
    <div className="legend-stack">
      <div
        className="legend-panel legend-single"
        aria-label={legendMode === 'layer' ? 'Layer order legend' : 'Stack height legend'}
      >
        <div className="layer-legend-header">
          <span>{legendMode === 'layer' ? 'Layer Legend' : 'Stack Legend'}</span>
          <span>{legendMode === 'layer' ? 'Front -> Back' : 'Height'}</span>
        </div>
        <div className="legend-mode-tabs" role="tablist" aria-label="Legend mode">
          <button className={legendMode === 'layer' ? 'active' : ''} onClick={() => onSetLegendMode('layer')} aria-pressed={legendMode === 'layer'}>
            Layer
          </button>
          <button className={legendMode === 'stack' ? 'active' : ''} onClick={() => onSetLegendMode('stack')} aria-pressed={legendMode === 'stack'}>
            Stack
          </button>
        </div>

        {legendMode === 'layer' ? (
          <div className="layer-legend-items">
            {layers.map((layer, index) => (
              <div key={layer.id} className="layer-legend-item">
                <span className="layer-legend-swatch" style={{ backgroundColor: layerColorsById[layer.id] ?? fallbackLayerStroke }} />
                <span className="layer-legend-label">
                  {index + 1}. {layer.name}
                  {layer.visible ? '' : ' (hidden)'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="stack-legend-items">
            {stackLegendEntries.map((entry) => (
              <div key={`stack-${entry.stackLevel}`} className="stack-legend-item">
                <span className="layer-legend-swatch" style={{ background: entry.swatchBackground }} />
                <span className="stack-level-chip">{`z${entry.stackLevel}`}</span>
                <span className="stack-level-label">{entry.layerNames.join(', ')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="legend-key-list">
          <div className="legend-key-item">
            <span className="layer-legend-swatch" style={{ backgroundColor: cutStrokeColor }} />
            <span>Cut lines</span>
          </div>
          <div className="legend-key-item">
            <span className="layer-legend-swatch" style={{ backgroundColor: stitchStrokeColor }} />
            <span>Stitch lines</span>
          </div>
          <div className="legend-key-item">
            <span className="layer-legend-swatch" style={{ backgroundColor: foldStrokeColor }} />
            <span>Bend lines / areas</span>
          </div>
        </div>
      </div>
    </div>
  )
}
