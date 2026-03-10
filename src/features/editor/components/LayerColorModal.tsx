import type { Layer } from '../cad/cad-types'
import { LayerColorSettingsSection } from './LayerColorSettingsSection'

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

        <LayerColorSettingsSection
          layers={layers}
          layerColorsById={layerColorsById}
          layerColorOverrides={layerColorOverrides}
          frontLayerColor={frontLayerColor}
          backLayerColor={backLayerColor}
          onFrontLayerColorChange={onFrontLayerColorChange}
          onBackLayerColorChange={onBackLayerColorChange}
          onSetLayerColorOverride={onSetLayerColorOverride}
          onClearLayerColorOverride={onClearLayerColorOverride}
          onResetLayerColors={onResetLayerColors}
        />
      </div>
    </div>
  )
}
