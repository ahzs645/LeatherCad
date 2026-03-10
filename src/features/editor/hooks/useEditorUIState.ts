import { useState } from 'react'
import type {
  DesktopRibbonTab,
  LegendMode,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  ResolvedThemeMode,
  SidePanelTab,
  SketchWorkspaceMode,
  ThemeMode,
} from '../editor-types'
import type { SecondaryPreviewMode, WorkbenchRibbonTab, WorkspaceMode } from '../workbench/workbench-types'
import { DEFAULT_GRID_SPACING } from '../editor-constants'
import { DEFAULT_PRESET_ID } from '../data/sample-doc'
import type { DisplayUnit } from '../ops/unit-ops'

const getSystemThemeMode = (): ResolvedThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useEditorUIState() {
  const [status, setStatus] = useState('Ready')
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('3d')
  const [show3dInMain, setShow3dInMain] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [showPrecisionModal, setShowPrecisionModal] = useState(false)
  const [showProjectMemoModal, setShowProjectMemoModal] = useState(false)
  const [showNestingModal, setShowNestingModal] = useState(false)
  const [desktopRibbonTab, setDesktopRibbonTab] = useState<DesktopRibbonTab>('build')
  const [workbenchRibbonTab, setWorkbenchRibbonTab] = useState<WorkbenchRibbonTab>('draft')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('2d')
  const [secondaryPreviewMode, setSecondaryPreviewMode] = useState<SecondaryPreviewMode>('3d-peek')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('mm')
  const [gridSpacing, setGridSpacing] = useState(DEFAULT_GRID_SPACING)
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [sketchWorkspaceMode, setSketchWorkspaceMode] = useState<SketchWorkspaceMode>('assembly')
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [systemThemeMode, setSystemThemeMode] = useState<ResolvedThemeMode>(() => getSystemThemeMode())
  const [loadedFontUrl, setLoadedFontUrl] = useState<string | null>(null)
  const [constraintSuggestions, setConstraintSuggestions] = useState<import('../ops/auto-constraint-ops').ConstraintSuggestion[]>([])
  const [autoConstraintSettings] = useState(() => ({
    enabled: true,
    horizontal: true,
    vertical: true,
    parallel: true,
    perpendicular: true,
    equalLength: true,
    tangent: true,
    angleTolerance: 3,
    distanceTolerance: 0.5,
  }))

  return {
    status, setStatus,
    showThreePreview, setShowThreePreview,
    sidePanelTab, setSidePanelTab,
    show3dInMain, setShow3dInMain,
    isMobileLayout, setIsMobileLayout,
    mobileViewMode, setMobileViewMode,
    showMobileMenu, setShowMobileMenu,
    mobileOptionsTab, setMobileOptionsTab,
    showPrecisionModal, setShowPrecisionModal,
    showProjectMemoModal, setShowProjectMemoModal,
    showNestingModal, setShowNestingModal,
    desktopRibbonTab, setDesktopRibbonTab,
    workbenchRibbonTab, setWorkbenchRibbonTab,
    workspaceMode, setWorkspaceMode,
    secondaryPreviewMode, setSecondaryPreviewMode,
    mobileLayerAction, setMobileLayerAction,
    mobileFileAction, setMobileFileAction,
    displayUnit, setDisplayUnit,
    gridSpacing, setGridSpacing,
    legendMode, setLegendMode,
    sketchWorkspaceMode, setSketchWorkspaceMode,
    selectedPresetId, setSelectedPresetId,
    themeMode, setThemeMode,
    systemThemeMode, setSystemThemeMode,
    loadedFontUrl, setLoadedFontUrl,
    constraintSuggestions, setConstraintSuggestions,
    autoConstraintSettings,
  }
}
