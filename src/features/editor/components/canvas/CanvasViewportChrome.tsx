import { useState } from 'react'
import { formatDisplayDistance, type DisplayUnit } from '../../ops/unit-ops'
import { pointInBounds, type Bounds } from './canvas-geometry'

const RULER_TICK_TARGET_SPACING_PX = 44
const RULER_LABEL_TARGET_SPACING_PX = 150

type CanvasViewportChromeProps = {
  showCanvasRuler: boolean
  displayUnit: DisplayUnit
  tracingOverlays: import('../../cad/cad-types').TracingOverlay[]
  onTracingOverlayOffset?: (overlayId: string, nextOffsetX: number, nextOffsetY: number) => void
  backdrops: import('../../cad/cad-types').Backdrop[]
  onBackdropLeftTop?: (backdropId: string, nextX: number, nextY: number) => void
  onSelectBackdrop?: (backdropId: string | null) => void
  activeBackdropId?: string | null
  viewport?: { scale: number }
  showPrintAreas: boolean
  printPlan: import('../../preview/print-preview').PrintPlan | null
  viewBounds: Bounds
  detailPadding: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function niceCeil(value: number) {
  const safeValue = Math.max(value, 0.0001)
  const exponent = Math.floor(Math.log10(safeValue))
  const magnitude = 10 ** exponent
  const normalized = safeValue / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

function isNearMultiple(value: number, step: number) {
  return Math.abs(value / step - Math.round(value / step)) < 0.0001
}

function buildRulerTickValues(start: number, end: number, step: number) {
  const first = Math.ceil(start / step) * step
  const values: number[] = []
  for (let value = first; value <= end + step * 0.5 && values.length < 260; value += step) {
    values.push(Math.round(value * 10000) / 10000)
  }
  return values
}

function rulerPrecision(step: number, displayUnit: DisplayUnit) {
  if (displayUnit === 'in') return step < 25.4 ? 2 : 1
  if (step < 1) return 2
  if (step < 10) return 1
  return 0
}

export function CanvasViewportChrome({
  showCanvasRuler,
  displayUnit,
  tracingOverlays,
  onTracingOverlayOffset,
  backdrops,
  onBackdropLeftTop,
  onSelectBackdrop,
  activeBackdropId,
  viewport,
  showPrintAreas,
  printPlan,
  viewBounds,
  detailPadding,
}: CanvasViewportChromeProps) {
  const viewportScale = Math.max(viewport?.scale ?? 1, 0.0001)
  // Local drag preview so the on-canvas tracing move generates one undo entry
  // (committed at pointer-up) instead of one per pointer-move (source v2.8.3).
  const [tracingDrag, setTracingDrag] = useState<{ overlayId: string; offsetX: number; offsetY: number } | null>(null)
  const rulerTickStep = niceCeil(RULER_TICK_TARGET_SPACING_PX / viewportScale)
  const rulerLabelStep = niceCeil(RULER_LABEL_TARGET_SPACING_PX / viewportScale)
  const xRulerTickValues = showCanvasRuler ? buildRulerTickValues(viewBounds.minX, viewBounds.maxX, rulerTickStep) : []
  const yRulerTickValues = showCanvasRuler ? buildRulerTickValues(viewBounds.minY, viewBounds.maxY, rulerTickStep) : []
  const rulerFontScreenPx = clamp(11 + Math.log2(Math.max(viewportScale, 1)) * 0.45, 11, 14)
  const rulerFontWorld = rulerFontScreenPx / viewportScale
  const rulerLabelStrokeWorld = 2.2 / viewportScale
  const majorTickWorld = 9 / viewportScale
  const minorTickWorld = 5 / viewportScale
  const rulerLabelGapWorld = 5 / viewportScale
  const rulerLabelPrecision = rulerPrecision(rulerLabelStep, displayUnit)

  return (
    <>
      <defs>
        <marker id="arrow-end" markerWidth="6" markerHeight="4" refX="5.5" refY="2" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 6 2, 0 4" fill="context-stroke" />
        </marker>
        <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="0.5" refY="2" orient="auto" markerUnits="strokeWidth">
          <polygon points="6 0, 0 2, 6 4" fill="context-stroke" />
        </marker>
      </defs>

      {showCanvasRuler && (
        <g className="xy-ruler-overlay">
          <line x1={-2400} y1={0} x2={2400} y2={0} className="xy-ruler-axis" />
          <line x1={0} y1={-2400} x2={0} y2={2400} className="xy-ruler-axis" />
          {xRulerTickValues.map((value) => {
            const major = isNearMultiple(value, rulerLabelStep)
            const tick = major ? majorTickWorld : minorTickWorld
            return (
              <g key={`ruler-x-${value}`}>
                <line x1={value} y1={-tick} x2={value} y2={tick} className="xy-ruler-tick" />
                {major && value !== 0 && (
                  <text
                    x={value}
                    y={-(tick + rulerLabelGapWorld)}
                    className="xy-ruler-label"
                    textAnchor="middle"
                    dominantBaseline="ideographic"
                    style={{ fontSize: `${rulerFontWorld}px`, strokeWidth: rulerLabelStrokeWorld }}
                  >
                    {formatDisplayDistance(value, displayUnit, rulerLabelPrecision)}
                  </text>
                )}
              </g>
            )
          })}
          {yRulerTickValues.map((value) => {
            const major = isNearMultiple(value, rulerLabelStep)
            const tick = major ? majorTickWorld : minorTickWorld
            return (
              <g key={`ruler-y-${value}`}>
                <line x1={-tick} y1={value} x2={tick} y2={value} className="xy-ruler-tick" />
                {major && value !== 0 && (
                  <text
                    x={tick + rulerLabelGapWorld}
                    y={value}
                    className="xy-ruler-label"
                    dominantBaseline="middle"
                    style={{ fontSize: `${rulerFontWorld}px`, strokeWidth: rulerLabelStrokeWorld }}
                  >
                    {formatDisplayDistance(-value, displayUnit, rulerLabelPrecision)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      )}

      <g className="canvas-backdrop-layer">
        {backdrops
          .filter((backdrop) => backdrop.visible)
          .map((backdrop) => {
            const cx = backdrop.leftTop.x + backdrop.width / 2
            const cy = backdrop.leftTop.y + backdrop.height / 2
            const pivot = backdrop.rotationCenter ?? { x: cx, y: cy }
            const transform = `rotate(${Math.round(backdrop.angleDeg * 1000) / 1000} ${pivot.x} ${pivot.y})`
            const draggable = !backdrop.locked && Boolean(onBackdropLeftTop)
            const isActive = activeBackdropId === backdrop.id
            return (
              <g
                key={backdrop.id}
                transform={transform}
                opacity={backdrop.opacity}
                style={{ cursor: draggable ? 'move' : undefined, pointerEvents: draggable ? 'auto' : 'none' }}
                onPointerDown={
                  draggable
                    ? (event) => {
                        event.stopPropagation()
                        onSelectBackdrop?.(backdrop.id)
                        const target = event.currentTarget
                        const startClientX = event.clientX
                        const startClientY = event.clientY
                        const startX = backdrop.leftTop.x
                        const startY = backdrop.leftTop.y
                        const viewportScale = viewport?.scale ?? 1
                        try {
                          target.setPointerCapture(event.pointerId)
                        } catch {
                          // ignore
                        }
                        const onMove = (moveEvent: PointerEvent) => {
                          const dx = (moveEvent.clientX - startClientX) / viewportScale
                          const dy = (moveEvent.clientY - startClientY) / viewportScale
                          onBackdropLeftTop?.(backdrop.id, startX + dx, startY + dy)
                        }
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove)
                          window.removeEventListener('pointerup', onUp)
                          window.removeEventListener('pointercancel', onUp)
                        }
                        window.addEventListener('pointermove', onMove)
                        window.addEventListener('pointerup', onUp)
                        window.addEventListener('pointercancel', onUp)
                      }
                    : undefined
                }
              >
                <image
                  href={backdrop.bitmapDataUrl}
                  x={Math.round(backdrop.leftTop.x * 1000) / 1000}
                  y={Math.round(backdrop.leftTop.y * 1000) / 1000}
                  width={Math.round(backdrop.width * 1000) / 1000}
                  height={Math.round(backdrop.height * 1000) / 1000}
                  preserveAspectRatio="xMidYMid meet"
                />
                {isActive && (
                  <rect
                    x={Math.round(backdrop.leftTop.x * 1000) / 1000}
                    y={Math.round(backdrop.leftTop.y * 1000) / 1000}
                    width={Math.round(backdrop.width * 1000) / 1000}
                    height={Math.round(backdrop.height * 1000) / 1000}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}
              </g>
            )
          })}
      </g>

      <g className="canvas-tracing-layer">
        {tracingOverlays
          .filter((overlay) => overlay.visible)
          .map((overlay) => {
            const scale = Number(overlay.scale.toFixed(4))
            const liveOffsetX =
              tracingDrag && tracingDrag.overlayId === overlay.id ? tracingDrag.offsetX : overlay.offsetX
            const liveOffsetY =
              tracingDrag && tracingDrag.overlayId === overlay.id ? tracingDrag.offsetY : overlay.offsetY
            const transform = `translate(${Math.round(liveOffsetX * 1000) / 1000} ${Math.round(liveOffsetY * 1000) / 1000}) rotate(${Math.round(
              overlay.rotationDeg * 1000,
            ) / 1000}) scale(${scale})`
            const x = Math.round((-overlay.width / 2) * 1000) / 1000
            const y = Math.round((-overlay.height / 2) * 1000) / 1000
            const draggable = !overlay.locked && Boolean(onTracingOverlayOffset)
            return (
              <g
                key={overlay.id}
                transform={transform}
                opacity={overlay.opacity}
                style={{ cursor: draggable ? 'move' : undefined, pointerEvents: draggable ? 'auto' : 'none' }}
                onPointerDown={
                  draggable
                    ? (event) => {
                        event.stopPropagation()
                        const target = event.currentTarget
                        const startClientX = event.clientX
                        const startClientY = event.clientY
                        const startOffsetX = overlay.offsetX
                        const startOffsetY = overlay.offsetY
                        const viewportScale = viewport?.scale ?? 1
                        try {
                          target.setPointerCapture(event.pointerId)
                        } catch {
                          // ignore
                        }
                        let finalOffsetX = startOffsetX
                        let finalOffsetY = startOffsetY
                        const onMove = (moveEvent: PointerEvent) => {
                          const dx = (moveEvent.clientX - startClientX) / viewportScale
                          const dy = (moveEvent.clientY - startClientY) / viewportScale
                          finalOffsetX = startOffsetX + dx
                          finalOffsetY = startOffsetY + dy
                          setTracingDrag({ overlayId: overlay.id, offsetX: finalOffsetX, offsetY: finalOffsetY })
                        }
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove)
                          window.removeEventListener('pointerup', onUp)
                          window.removeEventListener('pointercancel', onUp)
                          setTracingDrag(null)
                          if (
                            Math.abs(finalOffsetX - startOffsetX) > 1e-4 ||
                            Math.abs(finalOffsetY - startOffsetY) > 1e-4
                          ) {
                            onTracingOverlayOffset?.(overlay.id, finalOffsetX, finalOffsetY)
                          }
                        }
                        window.addEventListener('pointermove', onMove)
                        window.addEventListener('pointerup', onUp)
                        window.addEventListener('pointercancel', onUp)
                      }
                    : undefined
                }
              >
                <image
                  href={overlay.sourceUrl}
                  x={x}
                  y={y}
                  width={Math.round(overlay.width * 1000) / 1000}
                  height={Math.round(overlay.height * 1000) / 1000}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            )
          })}
      </g>

      {showPrintAreas &&
        printPlan &&
        printPlan.tiles
          .filter((tile) => pointInBounds({ x: tile.minX, y: tile.minY }, viewBounds, detailPadding))
          .map((tile) => (
            <g key={tile.id} className="print-area-group">
              <rect x={tile.minX} y={tile.minY} width={tile.width} height={tile.height} className="print-area-rect" />
              <text x={tile.minX + 8} y={tile.minY + 16} className="print-area-label">
                {`P${tile.row + 1}-${tile.col + 1}`}
              </text>
            </g>
          ))}
    </>
  )
}
