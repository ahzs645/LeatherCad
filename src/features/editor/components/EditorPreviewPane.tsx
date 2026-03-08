import { lazy, Suspense } from 'react'
import type { FoldLine, Layer, LineType, Shape, StitchHole, TextureSource } from '../cad/cad-types'
import type { ResolvedThemeMode, SidePanelTab } from '../editor-types'
import { LayerSidePanel } from './LayerSidePanel'

const ThreePreviewPanel = lazy(() =>
  import('./ThreePreviewPanel').then((mod) => ({ default: mod.ThreePreviewPanel })),
)

type EditorPreviewPaneProps = {
  showSidePanel: boolean
  hidePreviewPane: boolean
  isMobileLayout: boolean
  mobileViewMode: 'editor' | 'preview' | 'split'
  sidePanelTab: SidePanelTab
  onSetSidePanelTab: (tab: SidePanelTab) => void
  shapes: Shape[]
  selectedShapeIds: string[]
  stitchHoles: StitchHole[]
  stitchThreadColor: string
  onSetStitchThreadColor: (color: string) => void
  threeTextureSource: TextureSource | null
  onSetThreeTextureSource: (source: TextureSource | null) => void
  threeTextureShapeIds: string[]
  onSetThreeTextureShapeIds: (shapeIds: string[]) => void
  foldLines: FoldLine[]
  layers: Layer[]
  lineTypes: LineType[]
  themeMode: ResolvedThemeMode
  onUpdateFoldLine: (foldLineId: string, updates: Partial<FoldLine>) => void
  // Layer panel props
  activeLayer: Layer | null
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
  // 3D in main area
  show3dInMain: boolean
  onToggle3dInMain: () => void
}

export function EditorPreviewPane({
  showSidePanel,
  hidePreviewPane,
  isMobileLayout,
  mobileViewMode,
  sidePanelTab,
  onSetSidePanelTab,
  shapes,
  selectedShapeIds,
  stitchHoles,
  stitchThreadColor,
  onSetStitchThreadColor,
  threeTextureSource,
  onSetThreeTextureSource,
  threeTextureShapeIds,
  onSetThreeTextureShapeIds,
  foldLines,
  layers,
  lineTypes,
  themeMode,
  onUpdateFoldLine,
  activeLayer,
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
  show3dInMain,
  onToggle3dInMain,
}: EditorPreviewPaneProps) {
  if (!showSidePanel) {
    return null
  }

  return (
    <aside
      className={`preview-pane ${hidePreviewPane ? 'panel-hidden' : ''} ${
        isMobileLayout && mobileViewMode === 'split' ? 'preview-pane-mobile-split' : ''
      }`}
    >
      {!isMobileLayout && (
        <div className="side-panel-tabs" role="tablist" aria-label="Side panel tabs">
          <button
            role="tab"
            aria-selected={sidePanelTab === '3d'}
            className={sidePanelTab === '3d' ? 'active' : ''}
            onClick={() => onSetSidePanelTab('3d')}
          >
            3D Preview
          </button>
          <button
            role="tab"
            aria-selected={sidePanelTab === 'layers'}
            className={sidePanelTab === 'layers' ? 'active' : ''}
            onClick={() => onSetSidePanelTab('layers')}
          >
            Layers
          </button>
          {sidePanelTab === '3d' && (
            <button
              type="button"
              className="side-panel-expand-btn"
              onClick={onToggle3dInMain}
              title={show3dInMain ? 'Restore split view' : 'Expand 3D to main area'}
            >
              {show3dInMain ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {(isMobileLayout || sidePanelTab === '3d') && (
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>Loading 3D preview...</div>}>
          <ThreePreviewPanel
            key={isMobileLayout ? 'mobile-preview' : 'desktop-preview'}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            stitchHoles={stitchHoles}
            stitchThreadColor={stitchThreadColor}
            onSetStitchThreadColor={onSetStitchThreadColor}
            threeTextureSource={threeTextureSource}
            onSetThreeTextureSource={onSetThreeTextureSource}
            threeTextureShapeIds={threeTextureShapeIds}
            onSetThreeTextureShapeIds={onSetThreeTextureShapeIds}
            foldLines={foldLines}
            layers={layers}
            lineTypes={lineTypes}
            themeMode={themeMode}
            isMobileLayout={isMobileLayout}
            onUpdateFoldLine={onUpdateFoldLine}
          />
        </Suspense>
      )}

      {!isMobileLayout && sidePanelTab === 'layers' && (
        <LayerSidePanel
          activeLayer={activeLayer}
          layers={layers}
          layerStackLevels={layerStackLevels}
          layerColorsById={layerColorsById}
          onSetActiveLayerId={onSetActiveLayerId}
          onClearDraft={onClearDraft}
          onAddLayer={onAddLayer}
          onRenameActiveLayer={onRenameActiveLayer}
          onToggleLayerVisibility={onToggleLayerVisibility}
          onToggleLayerLock={onToggleLayerLock}
          onMoveLayerUp={onMoveLayerUp}
          onMoveLayerDown={onMoveLayerDown}
          onDeleteLayer={onDeleteLayer}
          onOpenLayerColorModal={onOpenLayerColorModal}
        />
      )}
    </aside>
  )
}
