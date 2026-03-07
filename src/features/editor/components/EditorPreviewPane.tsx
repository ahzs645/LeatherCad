import { lazy, Suspense } from 'react'
import type { FoldLine, Layer, LineType, Shape, StitchHole, TextureSource } from '../cad/cad-types'
import type { ResolvedThemeMode } from '../editor-types'

const ThreePreviewPanel = lazy(() =>
  import('./ThreePreviewPanel').then((mod) => ({ default: mod.ThreePreviewPanel })),
)

type EditorPreviewPaneProps = {
  showThreePreview: boolean
  hidePreviewPane: boolean
  isMobileLayout: boolean
  mobileViewMode: 'editor' | 'preview' | 'split'
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
}

export function EditorPreviewPane({
  showThreePreview,
  hidePreviewPane,
  isMobileLayout,
  mobileViewMode,
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
    </aside>
  )
}
