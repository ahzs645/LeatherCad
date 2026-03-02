import type { Layer } from '../cad/cad-types'
import { DEFAULT_FRONT_LAYER_COLOR } from '../editor-constants'

type LayerColorModalProps = {
  open: boolean
  onClose: () => void
  layers: Layer[]
  layerColorsById: Record<string, string>
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
  onFrontLayerColorChange: (color: string) => void
  onBackLayerColorChange: (color: string) => void
  onSetLayerColorOverride: (layerId: string, color: string) => void
  onClearLayerColorOverride: (layerId: string) => void
  onResetLayerColors: () => void
}

export function LayerColorModal({
  open,
  onClose,
  layers,
  layerColorsById,
  layerColorOverrides,
  frontLayerColor,
  backLayerColor,
  onFrontLayerColorChange,
  onBackLayerColorChange,
  onSetLayerColorOverride,
  onClearLayerColorOverride,
  onResetLayerColors,
}: LayerColorModalProps) {
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
      <div className="layer-color-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="layer-color-modal-header">
          <h2>Layer Color Settings</h2>
          <button onClick={onClose}>Done</button>
        </div>

        <p className="hint">Layer 1 is treated as front. Lower rows move toward back.</p>

        <div className="layer-color-range">
          <label className="field-row">
            <span>Front color</span>
            <input type="color" value={frontLayerColor} onChange={(event) => onFrontLayerColorChange(event.target.value)} />
          </label>
          <label className="field-row">
            <span>Back color</span>
            <input type="color" value={backLayerColor} onChange={(event) => onBackLayerColorChange(event.target.value)} />
          </label>
        </div>

        <div
          className="layer-color-gradient-preview"
          style={{
            background: `linear-gradient(90deg, ${frontLayerColor}, ${backLayerColor})`,
          }}
        />

        <div className="layer-color-list">
          {layers.map((layer, index) => {
            const color = layerColorsById[layer.id] ?? DEFAULT_FRONT_LAYER_COLOR
            const hasOverride = layer.id in layerColorOverrides
            return (
              <div key={layer.id} className="layer-color-item">
                <span className="layer-color-order">{index + 1}</span>
                <span className="layer-color-name">{layer.name}</span>
                <input type="color" value={color} onChange={(event) => onSetLayerColorOverride(layer.id, event.target.value)} />
                <button
                  onClick={() => onClearLayerColorOverride(layer.id)}
                  disabled={!hasOverride}
                  title={hasOverride ? 'Remove custom color override' : 'Using continuum color'}
                >
                  Auto
                </button>
              </div>
            )
          })}
        </div>

        <div className="layer-color-modal-actions">
          <button onClick={onResetLayerColors}>Reset Colors</button>
        </div>
      </div>
    </div>
  )
}
