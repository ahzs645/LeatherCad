import type { DesktopRibbonTab, MobileOptionsTab, MobileViewMode } from '../editor-types'

type UseEditorLayoutFlagsParams = {
  isMobileLayout: boolean
  mobileViewMode: MobileViewMode
  showThreePreview: boolean
  showMobileMenu: boolean
  mobileOptionsTab: MobileOptionsTab
  desktopRibbonTab: DesktopRibbonTab
}

type EditorLayoutFlags = {
  workspaceClassName: string
  topbarClassName: string
  hideCanvasPane: boolean
  hidePreviewPane: boolean
  showToolSection: boolean
  showPresetSection: boolean
  showZoomSection: boolean
  showEditSection: boolean
  showLineTypeSection: boolean
  showStitchSection: boolean
  showLayerSection: boolean
  showFileSection: boolean
  showLayerLegend: boolean
}

export function useEditorLayoutFlags(params: UseEditorLayoutFlagsParams): EditorLayoutFlags {
  const {
    isMobileLayout,
    mobileViewMode,
    showThreePreview,
    showMobileMenu,
    mobileOptionsTab,
    desktopRibbonTab,
  } = params

  const workspaceClassName = `workspace ${isMobileLayout ? `mobile-${mobileViewMode}` : 'desktop'}`
  const topbarClassName = `topbar ${isMobileLayout ? 'topbar-mobile' : `desktop-ribbon-tab-${desktopRibbonTab}`} ${
    isMobileLayout && !showMobileMenu ? 'topbar-compact' : ''
  }`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)
  const showViewOptions = showMobileMenu && mobileOptionsTab === 'view'
  const showLayerOptions = showMobileMenu && mobileOptionsTab === 'layers'
  const showFileOptions = showMobileMenu && mobileOptionsTab === 'file'
  const showDesktopToolSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopPresetSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopZoomSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopEditSection = desktopRibbonTab === 'edit'
  const showDesktopLineTypeSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopStitchSection = desktopRibbonTab === 'stitch'
  const showDesktopLayerSection =
    desktopRibbonTab === 'build' ||
    desktopRibbonTab === 'edit' ||
    desktopRibbonTab === 'stitch' ||
    desktopRibbonTab === 'layers'
  const showDesktopFileSection = desktopRibbonTab === 'output'
  const showToolSection = isMobileLayout || showDesktopToolSection
  const showPresetSection = isMobileLayout ? showViewOptions : showDesktopPresetSection
  const showZoomSection = isMobileLayout ? showViewOptions : showDesktopZoomSection
  const showEditSection = isMobileLayout ? showViewOptions : showDesktopEditSection
  const showLineTypeSection = isMobileLayout ? showViewOptions : showDesktopLineTypeSection
  const showStitchSection = isMobileLayout ? showViewOptions : showDesktopStitchSection
  const showLayerSection = isMobileLayout ? showLayerOptions : showDesktopLayerSection
  const showFileSection = isMobileLayout ? showFileOptions : showDesktopFileSection
  const showLayerLegend = !(isMobileLayout && mobileViewMode === 'split')

  return {
    workspaceClassName,
    topbarClassName,
    hideCanvasPane,
    hidePreviewPane,
    showToolSection,
    showPresetSection,
    showZoomSection,
    showEditSection,
    showLineTypeSection,
    showStitchSection,
    showLayerSection,
    showFileSection,
    showLayerLegend,
  }
}
