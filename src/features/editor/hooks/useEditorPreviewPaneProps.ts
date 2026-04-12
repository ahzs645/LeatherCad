import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type { Layer } from '../cad/cad-types'
import { EditorPreviewPane } from '../components/EditorPreviewPane'
import { sanitizeFoldLine } from '../editor-parsers'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorSelectionSelector } from '../state/providers/EditorSelectionStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'

type UseEditorPreviewPanePropsParams = Pick<
  ComponentProps<typeof EditorPreviewPane>,
  | 'shapes'
  | 'stitchHoles'
  | 'layers'
  | 'themeMode'
  | 'activeLayer'
  | 'layerStackLevels'
  | 'layerColorsById'
> & {
  setLayers: Dispatch<SetStateAction<Layer[]>>
  hidePreviewPane: boolean
  onSetActiveLayerId: ComponentProps<typeof EditorPreviewPane>['onSetActiveLayerId']
  onClearDraft: ComponentProps<typeof EditorPreviewPane>['onClearDraft']
  onAddLayer: ComponentProps<typeof EditorPreviewPane>['onAddLayer']
  onRenameActiveLayer: ComponentProps<typeof EditorPreviewPane>['onRenameActiveLayer']
  onMoveLayerUp: ComponentProps<typeof EditorPreviewPane>['onMoveLayerUp']
  onMoveLayerDown: ComponentProps<typeof EditorPreviewPane>['onMoveLayerDown']
  onDeleteLayer: ComponentProps<typeof EditorPreviewPane>['onDeleteLayer']
  onOpenLayerColorModal: ComponentProps<typeof EditorPreviewPane>['onOpenLayerColorModal']
}

export function useEditorPreviewPaneProps(params: UseEditorPreviewPanePropsParams): ComponentProps<typeof EditorPreviewPane> {
  const {
    setLayers,
    hidePreviewPane,
    shapes,
    stitchHoles,
    layers,
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
  } = params
  const selectedShapeIds = useEditorSelectionSelector((state) => state.selectedShapeIds)
  const {
    stitchThreadColor,
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    threeTextureSource,
    threeTextureShapeIds,
    foldLines,
    lineTypes,
  } = useEditorDocumentSelector((state) => ({
    stitchThreadColor: state.stitchThreadColor,
    patternPieces: state.patternPieces,
    piecePlacements3d: state.piecePlacements3d,
    seamConnections: state.seamConnections,
    threePreviewSettings: state.threePreviewSettings,
    avatars: state.avatars,
    threeTextureSource: state.threeTextureSource,
    threeTextureShapeIds: state.threeTextureShapeIds,
    foldLines: state.foldLines,
    lineTypes: state.lineTypes,
  }))
  const {
    setFoldLines,
    setStitchThreadColor,
    setPiecePlacements3d,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
  } = useEditorDocumentActions()
  const {
    showThreePreview,
    isMobileLayout,
    mobileViewMode,
    sidePanelTab,
    show3dInMain,
  } = useEditorUISelector((state) => ({
    showThreePreview: state.showThreePreview,
    isMobileLayout: state.isMobileLayout,
    mobileViewMode: state.mobileViewMode,
    sidePanelTab: state.sidePanelTab,
    show3dInMain: state.show3dInMain,
  }))
  const { setSidePanelTab, setShow3dInMain, setShowThreePreview } = useEditorUIActions()

  return {
    showSidePanel: showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    sidePanelTab,
    onSetSidePanelTab: setSidePanelTab,
    shapes,
    selectedShapeIds,
    stitchHoles,
    stitchThreadColor,
    onSetStitchThreadColor: setStitchThreadColor,
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d: setPiecePlacements3d,
    onSetThreePreviewSettings: setThreePreviewSettings,
    onSetAvatars: setAvatars,
    threeTextureSource,
    onSetThreeTextureSource: setThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds: setThreeTextureShapeIds,
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
    onToggle3dInMain: () => {
      setShow3dInMain((previous) => {
        const next = !previous
        if (next) {
          setSidePanelTab('3d')
          setShowThreePreview(true)
        }
        return next
      })
    },
  }
}
