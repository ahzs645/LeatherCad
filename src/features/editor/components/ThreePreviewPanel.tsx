import { useState } from 'react'
import type { ThreePreviewControllerProps } from '../hooks/useThreePreviewController'
import { useThreePreviewController } from '../hooks/useThreePreviewController'
import { WorkbenchThreePreviewInspector } from '../workbench/WorkbenchThreePreview'

type ThreePreviewPanelProps = ThreePreviewControllerProps & {
  isMobileLayout: boolean
}

export function ThreePreviewPanel({
  isMobileLayout,
  ...controllerProps
}: ThreePreviewPanelProps) {
  const controller = useThreePreviewController(controllerProps)
  const [showControls, setShowControls] = useState(!isMobileLayout)

  const {
    containerRef,
    canvasRef,
    captureStudioStill,
    foldLines,
    invalidPatternPieces,
    isStudioRendering,
    seamConnections,
    shapesIn3dView,
    stitchHoles,
    studioRenderStatus,
    threePreviewSettings,
    visiblePatternPieces,
  } = controller

  return (
    <div className={`three-preview-shell ${showControls ? '' : 'preview-controls-collapsed'}`}>
      <div className="three-preview-header">
        <div>
          <h2>3D Preview Bridge</h2>
          <p>2D shapes: {shapesIn3dView.length} | pieces: {visiblePatternPieces.length}</p>
          <p>Mode: {threePreviewSettings.mode} | fold lines: {foldLines.length} | seams: {seamConnections.length}</p>
          <p>Stitch holes: {stitchHoles.length}</p>
          {invalidPatternPieces.length > 0 ? <p className="hint">{invalidPatternPieces.length} piece(s) are missing valid closed boundaries for 3D.</p> : null}
          <p className="hint">Drag to orbit, two-finger pinch or wheel to zoom, right-drag/two-finger drag to pan.</p>
          <button
            className="preview-controls-toggle"
            onClick={() => void captureStudioStill()}
            disabled={isStudioRendering}
            title="Path-traced beauty shot of the current model, rendered on a studio backdrop"
          >
            {isStudioRendering ? 'Rendering…' : 'Studio Render'}
          </button>
          {studioRenderStatus ? <p className="hint">{studioRenderStatus}</p> : null}
        </div>
        {isMobileLayout && (
          <button className="preview-controls-toggle" onClick={() => setShowControls((previous) => !previous)}>
            {showControls ? 'Hide Controls' : 'Show Controls'}
          </button>
        )}
      </div>

      <div ref={containerRef} className="three-preview-canvas-wrap">
        <canvas ref={canvasRef} className="three-preview-canvas" />
      </div>

      {showControls && (
        <div className="three-preview-controls">
          <WorkbenchThreePreviewInspector controller={controller} />
        </div>
      )}
    </div>
  )
}
