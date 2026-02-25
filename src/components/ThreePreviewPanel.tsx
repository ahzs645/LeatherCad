import { useEffect, useRef, useState } from 'react'
import type { FoldLine, Shape, TextureSource } from '../cad-types'
import { ThreeBridge } from '../three-bridge'

type ThreePreviewPanelProps = {
  shapes: Shape[]
  foldLines: FoldLine[]
  isMobileLayout: boolean
  onUpdateFoldLine: (foldLineId: string, angleDeg: number) => void
}

const DEFAULT_TEXTURE_FORM: TextureSource = {
  sourceUrl: '',
  license: '',
  albedoUrl: '',
  normalUrl: '',
  roughnessUrl: '',
}

export function ThreePreviewPanel({ shapes, foldLines, isMobileLayout, onUpdateFoldLine }: ThreePreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bridgeRef = useRef<ThreeBridge | null>(null)

  const [textureForm, setTextureForm] = useState<TextureSource>(DEFAULT_TEXTURE_FORM)
  const [textureStatus, setTextureStatus] = useState('Default leather material active')
  const [showControls, setShowControls] = useState(!isMobileLayout)

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const bridge = new ThreeBridge(canvasRef.current)
    bridgeRef.current = bridge

    const observer = new ResizeObserver(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      bridge.resize(container.clientWidth, container.clientHeight)
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
      bridge.resize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }

    return () => {
      observer.disconnect()
      bridge.dispose()
      bridgeRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!bridgeRef.current) {
      return
    }

    bridgeRef.current.setShapes(shapes)
    bridgeRef.current.setFoldLines(foldLines)
  }, [shapes, foldLines])

  return (
    <div className={`three-preview-shell ${showControls ? '' : 'preview-controls-collapsed'}`}>
      <div className="three-preview-header">
        <div>
          <h2>3D Preview Bridge</h2>
          <p>2D shapes: {shapes.length} | fold lines: {foldLines.length}</p>
          <p className="hint">Drag to orbit, two-finger pinch or wheel to zoom, right-drag/two-finger drag to pan.</p>
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
          <div className="control-block">
            <h3>Bend Controls</h3>
            {foldLines.length === 0 ? (
              <p className="hint">Use the Fold tool in 2D canvas to assign bend lines.</p>
            ) : (
              foldLines.map((foldLine) => (
                <label key={foldLine.id} className="field-row">
                  <span>
                    {foldLine.name}: {Math.round(foldLine.angleDeg)} deg
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={foldLine.maxAngleDeg}
                    value={foldLine.angleDeg}
                    onChange={(event) => onUpdateFoldLine(foldLine.id, Number(event.target.value))}
                  />
                </label>
              ))
            )}
          </div>

          <div className="control-block">
            <h3>Texture Source</h3>
            <label className="field-row">
              <span>Texture source URL</span>
              <input
                value={textureForm.sourceUrl}
                placeholder="https://..."
                onChange={(event) =>
                  setTextureForm((previous) => ({
                    ...previous,
                    sourceUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-row">
              <span>License note</span>
              <input
                value={textureForm.license}
                placeholder="CC0 / paid / attribution required"
                onChange={(event) =>
                  setTextureForm((previous) => ({
                    ...previous,
                    license: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-row">
              <span>Albedo/base color URL</span>
              <input
                value={textureForm.albedoUrl}
                placeholder="https://..."
                onChange={(event) =>
                  setTextureForm((previous) => ({
                    ...previous,
                    albedoUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-row">
              <span>Normal map URL (optional)</span>
              <input
                value={textureForm.normalUrl ?? ''}
                placeholder="https://..."
                onChange={(event) =>
                  setTextureForm((previous) => ({
                    ...previous,
                    normalUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-row">
              <span>Roughness map URL (optional)</span>
              <input
                value={textureForm.roughnessUrl ?? ''}
                placeholder="https://..."
                onChange={(event) =>
                  setTextureForm((previous) => ({
                    ...previous,
                    roughnessUrl: event.target.value,
                  }))
                }
              />
            </label>

            <div className="button-row">
              <button
                onClick={async () => {
                  if (!bridgeRef.current) {
                    return
                  }

                  if (!textureForm.albedoUrl.trim()) {
                    setTextureStatus('Set at least an albedo URL before applying texture')
                    return
                  }

                  try {
                    setTextureStatus('Loading texture set...')
                    await bridgeRef.current.setTexture(textureForm)
                    setTextureStatus('Texture set applied to wallet preview')
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'unknown error'
                    setTextureStatus(`Texture load failed: ${message}`)
                  }
                }}
              >
                Apply Texture
              </button>
              <button
                onClick={() => {
                  bridgeRef.current?.useDefaultTexture()
                  setTextureStatus('Switched back to default leather material')
                }}
              >
                Reset Material
              </button>
            </div>
            <p className="hint">{textureStatus}</p>
          </div>
        </div>
      )}
    </div>
  )
}
