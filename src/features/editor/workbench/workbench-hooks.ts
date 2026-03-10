import { useMemo } from 'react'
import type {
  DocumentBrowserModelParams,
  InspectorContext,
  RibbonCommandGroup,
  WorkbenchRibbonTab,
} from './workbench-types'
import type { HardwareMarker, PatternPiece, Shape, StitchHole } from '../cad/cad-types'
import {
  buildDocumentBrowserModel,
  buildInspectorContext,
  buildQuickActions,
  buildRibbonModel,
} from './workbench-models'

export function useDocumentBrowserModel(params: DocumentBrowserModelParams) {
  return useMemo(() => buildDocumentBrowserModel(params), [params])
}

export function useInspectorModel(params: {
  selectedShapes: Shape[]
  selectedPatternPiece: PatternPiece | null
  selectedStitchHole: StitchHole | null
  selectedHardwareMarker: HardwareMarker | null
}): InspectorContext {
  return useMemo(() => buildInspectorContext(params), [params])
}

export function useRibbonModel(params: {
  activeTab: WorkbenchRibbonTab
  canUndo: boolean
  canRedo: boolean
  canPaste: boolean
  selectedShapeCount: number
  selectedPatternPiece: boolean
  selectedStitchHole: boolean
}): RibbonCommandGroup[] {
  return useMemo(() => buildRibbonModel(params), [params])
}

export function useQuickActions(params: { canUndo: boolean; canRedo: boolean }) {
  return useMemo(() => buildQuickActions(params), [params])
}
