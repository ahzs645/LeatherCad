import { formatDisplayDistance, type DisplayUnit } from '../../ops/unit-ops'
import { pointInBounds, type Bounds } from './canvas-geometry'

type CanvasViewportChromeProps = {
  minorGridPatternId: string
  majorGridPatternId: string
  minorGridStep: number
  gridSpacing: number
  gridExtent: number
  showCanvasRuler: boolean
  displayUnit: DisplayUnit
  tracingOverlays: import('../../cad/cad-types').TracingOverlay[]
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
  displayUnit,
  tracingOverlays,
  showPrintAreas,
  printPlan,
  viewBounds,
  detailPadding,
}: CanvasViewportChromeProps) {
  const rulerTickValues = showCanvasRuler ? Array.from({ length: 81 }, (_, index) => (index - 40) * 50) : []

  return (
    <>
      <defs>
        <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
        </marker>
        <marker id="arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="10 0, 0 3.5, 10 7" fill="context-stroke" />
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
        <rect
          x={-gridExtent}
          y={-gridExtent}
          width={gridExtent * 2}
          height={gridExtent * 2}
          fill={`url(#${majorGridPatternId})`}
        />
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
            return (
              <g key={overlay.id} transform={transform} opacity={overlay.opacity}>
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
