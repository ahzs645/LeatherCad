import { lineTypeStrokeDasharray } from '../cad/line-types'
import type { Layer, LineType } from '../cad/cad-types'
import type { LegendMode, SketchWorkspaceMode } from '../editor-types'

type StackLegendEntry = {
  stackLevel: number
  layerNames: string[]
  swatchBackground: string
}

type LayerLegendPanelProps = {
  show: boolean
  legendMode: LegendMode
  onSetLegendMode: (mode: LegendMode) => void
  sketchWorkspaceMode: SketchWorkspaceMode
  layers: Layer[]
  lineTypes: LineType[]
  layerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stackLegendEntries: StackLegendEntry[]
  cutStrokeColor: string
  stitchStrokeColor: string
  foldStrokeColor: string
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function withAlpha(color: string, alphaHex: string) {
  if (HEX_COLOR_PATTERN.test(color)) {
    return `${color}${alphaHex}`
  }
  return color
}

export function LayerLegendPanel({
  show,
  legendMode,
  onSetLegendMode,
  sketchWorkspaceMode,
  layers,
  lineTypes,
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

  const isSketchWorkspace = sketchWorkspaceMode === 'sketch'
  const visibleLineTypes = lineTypes.filter((lineType) => lineType.visible)
  const sketchLegendLineTypes = visibleLineTypes.length > 0 ? visibleLineTypes : lineTypes

  return (
    <div className="legend-stack">
      <div
        className="legend-panel legend-single"
        aria-label={
          isSketchWorkspace ? 'Line type legend' : legendMode === 'layer' ? 'Layer order legend' : 'Stack height legend'
        }
      >
        <div className="layer-legend-header">
          <span>{isSketchWorkspace ? 'Line Type Legend' : legendMode === 'layer' ? 'Layer Legend' : 'Stack Legend'}</span>
          <span>{isSketchWorkspace ? 'Sketch View' : legendMode === 'layer' ? 'Front -> Back' : 'Height'}</span>
        </div>

        {!isSketchWorkspace && (
          <>
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
                {layers.map((layer, index) => {
                  const layerColor = layerColorsById[layer.id] ?? fallbackLayerStroke
                  return (
                    <div key={layer.id} className="layer-legend-item">
                      <span
                        className="layer-legend-swatch"
                        style={{
                          backgroundColor: withAlpha(layerColor, '3d'),
                          borderColor: layerColor,
                        }}
                      />
                      <span className="layer-legend-label">
                        {index + 1}. {layer.name}
                        {layer.visible ? '' : ' (hidden)'}
                      </span>
                    </div>
                  )
                })}
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
          </>
        )}

        <div className="legend-key-list">
          {isSketchWorkspace ? (
            sketchLegendLineTypes.length > 0 ? (
              sketchLegendLineTypes.map((lineType) => (
                <div key={lineType.id} className="legend-key-item">
                  <svg className="legend-line-swatch" viewBox="0 0 24 14" aria-hidden="true">
                    <line
                      x1={1.5}
                      y1={7}
                      x2={22.5}
                      y2={7}
                      style={{
                        stroke: lineType.color,
                        strokeWidth: 2.4,
                        strokeLinecap: 'round',
                        strokeDasharray: lineTypeStrokeDasharray(lineType.style),
                      }}
                    />
                  </svg>
                  <span>{`${lineType.name} (${lineType.role})`}</span>
                </div>
              ))
            ) : (
              <div className="legend-empty-note">No line types available.</div>
            )
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
