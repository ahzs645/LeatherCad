import type { Layer } from '../cad/cad-types'

type LayerSidePanelProps = {
  activeLayer: Layer | null
  layers: Layer[]
  layerStackLevels: Record<string, number>
  layerColorsById: Record<string, string>
  onSetActiveLayerId: (layerId: string) => void
  onClearDraft: () => void
  onAddLayer: () => void
  onRenameActiveLayer: () => void
  onToggleLayerVisibility: (layerId: string) => void
  onToggleLayerLock: (layerId: string) => void
  onMoveLayerUp: () => void
  onMoveLayerDown: () => void
  onDeleteLayer: () => void
  onOpenLayerColorModal: () => void
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

export function LayerSidePanel({
  activeLayer,
  layers,
  layerStackLevels,
  layerColorsById,
  onSetActiveLayerId,
  onClearDraft,
  onAddLayer,
  onRenameActiveLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onMoveLayerUp,
  onMoveLayerDown,
  onDeleteLayer,
  onOpenLayerColorModal,
}: LayerSidePanelProps) {
  return (
    <div className="layer-side-panel">
      <div className="layer-side-list">
        {layers.map((layer, index) => {
          const isActive = activeLayer?.id === layer.id
          const color = layerColorsById[layer.id]
          return (
            <div
              key={layer.id}
              className={`layer-side-item${isActive ? ' active' : ''}${!layer.visible ? ' hidden-layer' : ''}${layer.locked ? ' locked-layer' : ''}`}
              onClick={() => {
                onSetActiveLayerId(layer.id)
                onClearDraft()
              }}
            >
              <button
                type="button"
                className="layer-side-toggle"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetActiveLayerId(layer.id)
                  onToggleLayerVisibility(layer.id)
                }}
              >
                <EyeIcon visible={layer.visible} />
              </button>
              <button
                type="button"
                className="layer-side-toggle"
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetActiveLayerId(layer.id)
                  onToggleLayerLock(layer.id)
                }}
              >
                <LockIcon locked={layer.locked} />
              </button>
              {color && (
                <span
                  className="layer-side-color"
                  style={{ background: color }}
                />
              )}
              <span className="layer-side-name">{layer.name}</span>
              <span className="layer-side-z">z{layerStackLevels[layer.id] ?? index}</span>
            </div>
          )
        })}
      </div>
      <div className="layer-side-toolbar">
        <button type="button" onClick={onAddLayer} title="Add layer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" onClick={onRenameActiveLayer} disabled={!activeLayer} title="Rename layer">
          Rename
        </button>
        <button type="button" onClick={onMoveLayerUp} disabled={!activeLayer || layers.length < 2} title="Move layer up">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button type="button" onClick={onMoveLayerDown} disabled={!activeLayer || layers.length < 2} title="Move layer down">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button type="button" onClick={onOpenLayerColorModal} disabled={layers.length === 0} title="Layer colors">
          Colors
        </button>
        <button type="button" onClick={onDeleteLayer} disabled={!activeLayer || layers.length < 2} title="Delete layer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
