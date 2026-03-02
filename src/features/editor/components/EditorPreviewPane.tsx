import type { FoldLine, Layer, LineType, Shape, StitchHole } from '../cad/cad-types'
import type { ResolvedThemeMode } from '../editor-types'
import { ThreePreviewPanel } from './ThreePreviewPanel'

type EditorPreviewPaneProps = {
  showThreePreview: boolean
  hidePreviewPane: boolean
  isMobileLayout: boolean
  mobileViewMode: 'editor' | 'preview' | 'split'
  shapes: Shape[]
  stitchHoles: StitchHole[]
  foldLines: FoldLine[]
  layers: Layer[]
  lineTypes: LineType[]
  themeMode: ResolvedThemeMode
  onUpdateFoldLine: (foldLineId: string, updates: Partial<FoldLine>) => void
}

export function EditorPreviewPane({
  showThreePreview,
  hidePreviewPane,
  isMobileLayout,
  mobileViewMode,
  shapes,
  stitchHoles,
  foldLines,
  layers,
  lineTypes,
  themeMode,
  onUpdateFoldLine,
}: EditorPreviewPaneProps) {
  if (!showThreePreview) {
    return null
  }

  return (
    <aside
      className={`preview-pane ${hidePreviewPane ? 'panel-hidden' : ''} ${
        isMobileLayout && mobileViewMode === 'split' ? 'preview-pane-mobile-split' : ''
      }`}
    >
      <ThreePreviewPanel
        key={isMobileLayout ? 'mobile-preview' : 'desktop-preview'}
        shapes={shapes}
        stitchHoles={stitchHoles}
        foldLines={foldLines}
        layers={layers}
        lineTypes={lineTypes}
        themeMode={themeMode}
        isMobileLayout={isMobileLayout}
        onUpdateFoldLine={onUpdateFoldLine}
      />
    </aside>
  )
}
