import type { Dispatch, PointerEventHandler, RefObject, SetStateAction } from 'react'
import type { Layer, LineType, Shape, StitchHole, Tool } from '../../cad/cad-types'
import type { ResolvedThemeMode, ThemeMode } from '../../editor-types'
import { toolLabel } from '../../editor-utils'
import type { DisplayUnit } from '../../ops/unit-ops'
import type { useEditorWorkbenchController } from '../../controllers/useEditorWorkbenchController'
import type { EditorWorkbenchProps } from '../../workbench/EditorWorkbench'
import type { WorkbenchThreeWorkspaceProps } from '../../workbench/WorkbenchThreeWorkspace'
import type { WorkbenchInspectorTab, WorkbenchRibbonTab } from '../../workbench/workbench-types'

type WorkbenchControllerModel = ReturnType<typeof useEditorWorkbenchController>

type BuildWorkbenchPropsParams = {
  controller: WorkbenchControllerModel
  shellRef: RefObject<HTMLElement | null>
  workspaceMode: EditorWorkbenchProps['workspaceMode']
  secondaryPreviewMode: EditorWorkbenchProps['secondaryPreviewMode']
  showPeek: boolean
  browserWidth: number
  inspectorWidth: number
  inspectorOpen: boolean
  inspectorRestoreWidth: number
  peekWidth: number
  splitterWidth: number
  toolRailWidth: number
  activeRibbonTab: WorkbenchRibbonTab
  themeMode: ThemeMode
  onSetRibbonTab: Dispatch<SetStateAction<WorkbenchRibbonTab>>
  onSetThemeMode: (mode: ThemeMode) => void
  setLayers: Dispatch<SetStateAction<Layer[]>>
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
  activeInspectorTab: WorkbenchInspectorTab
  onSetActiveInspectorTab: (tab: WorkbenchInspectorTab) => void
  onStartBrowserResize: PointerEventHandler<HTMLDivElement>
  onStartPeekResize: PointerEventHandler<HTMLDivElement>
  onStartInspectorResize: PointerEventHandler<HTMLDivElement>
  onToggleInspector: () => void
  zoomScale: number
  displayUnit: DisplayUnit
  activeLayer: Layer | null
  activeLineType: LineType | null
  onTogglePrecision: () => void
}

export function buildWorkbenchProps({
  controller,
  shellRef,
  workspaceMode,
  secondaryPreviewMode,
  showPeek,
  browserWidth,
  inspectorWidth,
  inspectorOpen,
  inspectorRestoreWidth,
  peekWidth,
  splitterWidth,
  toolRailWidth,
  activeRibbonTab,
  themeMode,
  onSetRibbonTab,
  onSetThemeMode,
  setLayers,
  tool,
  onSetActiveTool,
  activeInspectorTab,
  onSetActiveInspectorTab,
  onStartBrowserResize,
  onStartPeekResize,
  onStartInspectorResize,
  onToggleInspector,
  zoomScale,
  displayUnit,
  activeLayer,
  activeLineType,
  onTogglePrecision,
}: BuildWorkbenchPropsParams): Omit<
  EditorWorkbenchProps,
  'inspectContent' | 'pieceContent' | 'previewContent' | 'documentContent' | 'twoDPane' | 'threeDPane' | 'precisionDrawer'
> {
  return {
    docLabel: controller.docLabel,
    shellRef,
    workspaceMode,
    secondaryPreviewMode,
    showPeek,
    browserWidth,
    inspectorWidth,
    inspectorOpen,
    inspectorRestoreWidth,
    peekWidth,
    splitterWidth,
    toolRailWidth,
    quickActions: controller.quickActions,
    onInvokeQuickAction: controller.handleWorkbenchQuickAction,
    onSetWorkspaceMode: controller.handleSetWorkbenchMode,
    onTogglePeek: controller.handleToggleWorkbenchPeek,
    activeRibbonTab,
    themeMode,
    ribbonGroups: controller.ribbonGroups,
    onSetRibbonTab,
    onInvokeRibbonCommand: controller.handleWorkbenchRibbonCommand,
    onSetThemeMode,
    browserNodes: controller.browserNodes,
    onActivateNode: controller.handleWorkbenchActivateNode,
    onToggleLayerVisibility: controller.handleToggleLayerVisibilityById,
    onToggleLayerGroupVisibility: (layerIds: string[]) => {
      if (layerIds.length === 0) {
        return
      }
      setLayers((previous) => {
        const layerIdSet = new Set(layerIds)
        const targetLayers = previous.filter((layer) => layerIdSet.has(layer.id))
        if (targetLayers.length === 0) {
          return previous
        }
        const shouldShow = targetLayers.some((layer) => !layer.visible)
        return previous.map((layer) =>
          layerIdSet.has(layer.id)
            ? {
                ...layer,
                visible: shouldShow,
              }
            : layer,
        )
      })
    },
    onToggleLayerLock: controller.handleToggleLayerLockById,
    onToggleTracingVisibility: controller.handleToggleTracingVisibilityById,
    onToggleTracingLock: controller.handleToggleTracingLockById,
    tool,
    onSetActiveTool,
    activeInspectorTab,
    onSetActiveInspectorTab,
    onStartBrowserResize,
    onStartPeekResize,
    onStartInspectorResize,
    onToggleInspector,
    toolLabel: toolLabel(tool),
    selectionText: controller.selectionText,
    zoomPercent: Math.round(zoomScale * 100),
    displayUnit,
    activeLayerName: activeLayer?.name ?? 'None',
    activeLineTypeName: activeLineType?.name ?? 'None',
    onTogglePrecision,
  }
}

type BuildWorkbenchThreeWorkspacePropsParams = {
  workspaceMode: WorkbenchThreeWorkspaceProps['workspaceMode']
  shapes: Shape[]
  selectedShapeIds: string[]
  stitchHoles: StitchHole[]
  stitchThreadColor: WorkbenchThreeWorkspaceProps['stitchThreadColor']
  onSetStitchThreadColor: WorkbenchThreeWorkspaceProps['onSetStitchThreadColor']
  patternPieces: WorkbenchThreeWorkspaceProps['patternPieces']
  pieceInterfaces: WorkbenchThreeWorkspaceProps['pieceInterfaces']
  assemblyConnections: WorkbenchThreeWorkspaceProps['assemblyConnections']
  piecePlacements3d: WorkbenchThreeWorkspaceProps['piecePlacements3d']
  seamConnections: WorkbenchThreeWorkspaceProps['seamConnections']
  hardwareMarkers: WorkbenchThreeWorkspaceProps['hardwareMarkers']
  threePreviewSettings: WorkbenchThreeWorkspaceProps['threePreviewSettings']
  avatars: WorkbenchThreeWorkspaceProps['avatars']
  onSetPiecePlacements3d: WorkbenchThreeWorkspaceProps['onSetPiecePlacements3d']
  onSetThreePreviewSettings: WorkbenchThreeWorkspaceProps['onSetThreePreviewSettings']
  onSetAvatars: WorkbenchThreeWorkspaceProps['onSetAvatars']
  threeTextureSource: WorkbenchThreeWorkspaceProps['threeTextureSource']
  onSetThreeTextureSource: WorkbenchThreeWorkspaceProps['onSetThreeTextureSource']
  threeTextureShapeIds: WorkbenchThreeWorkspaceProps['threeTextureShapeIds']
  onSetThreeTextureShapeIds: WorkbenchThreeWorkspaceProps['onSetThreeTextureShapeIds']
  foldLines: WorkbenchThreeWorkspaceProps['foldLines']
  layers: WorkbenchThreeWorkspaceProps['layers']
  lineTypes: WorkbenchThreeWorkspaceProps['lineTypes']
  themeMode: ResolvedThemeMode
  onUpdateFoldLine: WorkbenchThreeWorkspaceProps['onUpdateFoldLine']
}

export function buildWorkbenchThreeWorkspaceProps({
  workspaceMode,
  shapes,
  selectedShapeIds,
  stitchHoles,
  stitchThreadColor,
  onSetStitchThreadColor,
  patternPieces,
  pieceInterfaces,
  assemblyConnections,
  piecePlacements3d,
  seamConnections,
  hardwareMarkers,
  threePreviewSettings,
  avatars,
  onSetPiecePlacements3d,
  onSetThreePreviewSettings,
  onSetAvatars,
  threeTextureSource,
  onSetThreeTextureSource,
  threeTextureShapeIds,
  onSetThreeTextureShapeIds,
  foldLines,
  layers,
  lineTypes,
  themeMode,
  onUpdateFoldLine,
}: BuildWorkbenchThreeWorkspacePropsParams): Omit<WorkbenchThreeWorkspaceProps, 'children'> {
  return {
    workspaceMode,
    shapes,
    selectedShapeIds,
    stitchHoles,
    stitchThreadColor,
    onSetStitchThreadColor,
    patternPieces,
    pieceInterfaces,
    assemblyConnections,
    piecePlacements3d,
    seamConnections,
    hardwareMarkers,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d,
    onSetThreePreviewSettings,
    onSetAvatars,
    threeTextureSource,
    onSetThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode,
    onUpdateFoldLine,
  }
}
