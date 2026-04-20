import { formatDisplayDistance, type DisplayUnit } from '../../ops/unit-ops'
import { pointInBounds, type Bounds } from './canvas-geometry'

type CanvasViewportChromeProps = {
  minorGridPatternId: string
  majorGridPatternId: string
  minorGridStep: number
  gridSpacing: number
  gridExtent: number
  showCanvasRuler: boolean
  showGrid?: boolean
  gridBackgroundMode?: 'light' | 'dark'
  displayUnit: DisplayUnit
  tracingOverlays: import('../../cad/cad-types').TracingOverlay[]
  onTracingOverlayOffset?: (overlayId: string, nextOffsetX: number, nextOffsetY: number) => void
  viewport?: { scale: number }
  showPrintAreas: boolean
  printPlan: import('../../preview/print-preview').PrintPlan | null
  viewBounds: Bounds
  detailPadding: number
}

export function CanvasViewportChrome({
  minorGridPatternId,
  majorGridPatternId,
  minorGridStep,
  gridSpacing,
  gridExtent,
  showCanvasRuler,
  showGrid = true,
  gridBackgroundMode = 'light',
  displayUnit,
  tracingOverlays,
  onTracingOverlayOffset,
  viewport,
  showPrintAreas,
  printPlan,
  viewBounds,
  detailPadding,
}: CanvasViewportChromeProps) {
  const rulerTickValues = showCanvasRuler ? Array.from({ length: 81 }, (_, index) => (index - 40) * 50) : []

  return (
    <>
      <defs>
        <marker id="arrow-end" markerWidth="6" markerHeight="4" refX="5.5" refY="2" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 6 2, 0 4" fill="context-stroke" />
        </marker>
        <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="0.5" refY="2" orient="auto" markerUnits="strokeWidth">
          <polygon points="6 0, 0 2, 6 4" fill="context-stroke" />
        </marker>
        <pattern id={minorGridPatternId} width={minorGridStep} height={minorGridStep} patternUnits="userSpaceOnUse">
          <path d={`M ${minorGridStep} 0 L 0 0 0 ${minorGridStep}`} className="grid-line-minor" fill="none" />
        </pattern>
        <pattern id={majorGridPatternId} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <rect width={gridSpacing} height={gridSpacing} fill={`url(#${minorGridPatternId})`} />
          <path d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`} className="grid-line" fill="none" />
        </pattern>
      </defs>

      <g className="canvas-grid-layer" style={{ pointerEvents: 'none' }}>
        {gridBackgroundMode === 'dark' && (
          <rect
            x={-gridExtent}
            y={-gridExtent}
            width={gridExtent * 2}
            height={gridExtent * 2}
            fill="#0f172a"
          />
        )}
        {showGrid && (
          <rect
            x={-gridExtent}
            y={-gridExtent}
            width={gridExtent * 2}
            height={gridExtent * 2}
            fill={`url(#${majorGridPatternId})`}
          />
        )}
        <line x1={-gridExtent} y1={0} x2={gridExtent} y2={0} className="axis-line" />
        <line x1={0} y1={-gridExtent} x2={0} y2={gridExtent} className="axis-line" />
      </g>

      {showCanvasRuler && (
        <g className="xy-ruler-overlay">
          <line x1={-2400} y1={0} x2={2400} y2={0} className="xy-ruler-axis" />
          <line x1={0} y1={-2400} x2={0} y2={2400} className="xy-ruler-axis" />
          {rulerTickValues.map((value) => {
            const major = value % 200 === 0
            const tick = major ? 7 : 4
            return (
              <g key={`ruler-x-${value}`}>
                <line x1={value} y1={-tick} x2={value} y2={tick} className="xy-ruler-tick" />
                {major && value !== 0 && (
                  <text x={value + 2} y={-9} className="xy-ruler-label">
                    {formatDisplayDistance(value, displayUnit, displayUnit === 'in' ? 2 : 0)}
                  </text>
                )}
              </g>
            )
          })}
          {rulerTickValues.map((value) => {
            const major = value % 200 === 0
            const tick = major ? 7 : 4
            return (
              <g key={`ruler-y-${value}`}>
                <line x1={-tick} y1={value} x2={tick} y2={value} className="xy-ruler-tick" />
                {major && value !== 0 && (
                  <text x={8} y={value - 2} className="xy-ruler-label">
                    {formatDisplayDistance(-value, displayUnit, displayUnit === 'in' ? 2 : 0)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      )}

      <g className="canvas-tracing-layer">
        {tracingOverlays
          .filter((overlay) => overlay.visible)
          .map((overlay) => {
            const scale = Number(overlay.scale.toFixed(4))
            const transform = `translate(${Math.round(overlay.offsetX * 1000) / 1000} ${Math.round(overlay.offsetY * 1000) / 1000}) rotate(${Math.round(
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
                        const onMove = (moveEvent: PointerEvent) => {
                          const dx = (moveEvent.clientX - startClientX) / viewportScale
                          const dy = (moveEvent.clientY - startClientY) / viewportScale
                          onTracingOverlayOffset?.(overlay.id, startOffsetX + dx, startOffsetY + dy)
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
