import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type { FoldLine, Layer } from '../cad/cad-types'
import { EditorPreviewPane } from '../components/EditorPreviewPane'
import { sanitizeFoldLine } from '../editor-parsers'

type UseEditorPreviewPanePropsParams = Omit<ComponentProps<typeof EditorPreviewPane>, 'onUpdateFoldLine' | 'onToggleLayerVisibility' | 'onToggleLayerLock'> & {
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setLayers: Dispatch<SetStateAction<Layer[]>>
}

export function useEditorPreviewPaneProps(params: UseEditorPreviewPanePropsParams): ComponentProps<typeof EditorPreviewPane> {
  const {
    setFoldLines,
    setLayers,
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
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d,
    onSetThreePreviewSettings,
    threeTextureSource,
    onSetThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode,
    activeLayer,
    layerStackLevels,
    layerColorsById,
    onSetActiveLayerId,
    onClearDraft,
    onAddLayer,
    onRenameActiveLayer,
    onMoveLayerUp,
    onMoveLayerDown,
    onDeleteLayer,
    onOpenLayerColorModal,
    show3dInMain,
    onToggle3dInMain,
  } = params

  return {
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
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d,
    onSetThreePreviewSettings,
    threeTextureSource,
    onSetThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode,
    onUpdateFoldLine: (foldLineId, updates) =>
      setFoldLines((previous) =>
        previous.map((foldLine) =>
          foldLine.id === foldLineId
            ? sanitizeFoldLine({
                ...foldLine,
                ...updates,
              })
            : foldLine,
        ),
      ),
    activeLayer,
    layerStackLevels,
    layerColorsById,
    onSetActiveLayerId,
    onClearDraft,
    onAddLayer,
    onRenameActiveLayer,
    onToggleLayerVisibility: (layerId: string) =>
      setLayers((previous) =>
        previous.map((layer) =>
          layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
        ),
      ),
    onToggleLayerLock: (layerId: string) =>
      setLayers((previous) =>
        previous.map((layer) =>
          layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
        ),
      ),
    onMoveLayerUp,
    onMoveLayerDown,
    onDeleteLayer,
    onOpenLayerColorModal,
    show3dInMain,
    onToggle3dInMain,
  }
}
