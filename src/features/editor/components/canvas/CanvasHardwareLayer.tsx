import type { HardwareMarker } from '../../cad/cad-types'

type CanvasHardwareLayerProps = {
  renderableHardwareMarkers: HardwareMarker[]
  selectedHardwareMarkerId: string | null
  viewportScale: number
  onHardwarePointerDown: (event: React.PointerEvent<SVGGElement>, markerId: string) => void
}

export function CanvasHardwareLayer({
  renderableHardwareMarkers,
  selectedHardwareMarkerId,
  viewportScale,
  onHardwarePointerDown,
}: CanvasHardwareLayerProps) {
  return (
    <>
      {renderableHardwareMarkers.map((marker) => {
        const isSelected = marker.id === selectedHardwareMarkerId
        return (
          <g
            key={marker.id}
            className={isSelected ? 'hardware-marker hardware-marker-selected' : 'hardware-marker'}
            onPointerDown={(event) => onHardwarePointerDown(event, marker.id)}
          >
            <circle cx={marker.point.x} cy={marker.point.y} r={3.2} />
            <line x1={marker.point.x - 4.2} y1={marker.point.y} x2={marker.point.x + 4.2} y2={marker.point.y} />
            <line x1={marker.point.x} y1={marker.point.y - 4.2} x2={marker.point.x} y2={marker.point.y + 4.2} />
            {viewportScale >= 0.35 && (
              <text x={marker.point.x + 4.8} y={marker.point.y - 4.8} className="hardware-marker-label">
                {`${marker.label} (${marker.holeDiameterMm.toFixed(1)}mm)`}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}
