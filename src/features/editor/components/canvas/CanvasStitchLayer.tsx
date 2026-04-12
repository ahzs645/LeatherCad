import { createStitchHolePrimitive } from '../../ops/stitch-hole-render'
import type { StitchHole } from '../../cad/cad-types'
import type { StitchSimulatorSettings, ThreadSegment } from '../../ops/stitch-simulator-ops'
import { buildDirectionArrowPoints } from './canvas-geometry'

type CanvasStitchLayerProps = {
  renderableStitchHoles: StitchHole[]
  selectedStitchHoleId: string | null
  showStitchSequenceLabels: boolean
  onStitchHolePointerDown: (event: React.PointerEvent<SVGElement>, stitchHoleId: string) => void
  renderableSimulatedSegments: ThreadSegment[]
  stitchSimulatorSettings: StitchSimulatorSettings | null
  renderableTerminalHole: StitchHole | null
  renderablePersistedTerminalHoles: StitchHole[]
  viewportScale: number
}

export function CanvasStitchLayer({
  renderableStitchHoles,
  selectedStitchHoleId,
  showStitchSequenceLabels,
  onStitchHolePointerDown,
  renderableSimulatedSegments,
  stitchSimulatorSettings,
  renderableTerminalHole,
  renderablePersistedTerminalHoles,
  viewportScale,
}: CanvasStitchLayerProps) {
  return (
    <>
      {!stitchSimulatorSettings?.showSimulatorPattern && (() => {
        const sorted = [...renderableStitchHoles].sort((a, b) => a.sequence - b.sequence)
        const pathParts: string[] = []
        for (let i = 1; i < sorted.length; i += 1) {
          const prev = sorted[i - 1]
          const curr = sorted[i]
          if (curr.sequence === prev.sequence + 1) {
            pathParts.push(`M${prev.point.x},${prev.point.y}L${curr.point.x},${curr.point.y}`)
          }
        }
        return pathParts.length > 0 ? <path d={pathParts.join('')} className="stitch-thread-line" /> : null
      })()}

      {stitchSimulatorSettings?.showSimulatorPattern && renderableSimulatedSegments.length > 0 && (
        <g className="stitch-simulator-layer" pointerEvents="none">
          {renderableSimulatedSegments.map((segment) => {
            const color =
              segment.threadIndex === 0
                ? stitchSimulatorSettings.threadColor
                : stitchSimulatorSettings.secondThreadColor
            const strokeWidth = Math.max(0.35, stitchSimulatorSettings.threadWidthMm)
            const arrowPoints = stitchSimulatorSettings.showDirectionArrows
              ? buildDirectionArrowPoints(segment, Math.max(1.8, strokeWidth * 3.4))
              : null

            return (
              <g key={`${segment.threadIndex}-${segment.stepIndex}-${segment.side}-${segment.from.x}-${segment.to.x}`}>
                <line
                  x1={segment.from.x}
                  y1={segment.from.y}
                  x2={segment.to.x}
                  y2={segment.to.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={segment.side === 'back' ? `${strokeWidth * 2.5} ${strokeWidth * 1.75}` : undefined}
                  opacity={segment.side === 'back' ? 0.58 : 0.94}
                />
                {arrowPoints && (
                  <polygon
                    points={arrowPoints}
                    fill={color}
                    opacity={segment.side === 'back' ? 0.7 : 0.95}
                  />
                )}
              </g>
            )
          })}
        </g>
      )}

      {renderablePersistedTerminalHoles.map((terminalHole) => {
        const primitive = createStitchHolePrimitive(terminalHole)
        const radius = Math.max(
          1.8,
          primitive.kind === 'circle'
            ? primitive.radiusMm * 3.2
            : 2.8,
        )
        return (
          <g key={`${terminalHole.id}-terminal`} className="stitch-hole-terminal-marker" pointerEvents="none">
            <circle
              cx={terminalHole.point.x}
              cy={terminalHole.point.y}
              r={radius}
              className="stitch-hole-terminal-ring"
            />
            <line
              x1={terminalHole.point.x - radius * 0.55}
              y1={terminalHole.point.y}
              x2={terminalHole.point.x + radius * 0.55}
              y2={terminalHole.point.y}
              className="stitch-hole-terminal-cross"
            />
            <line
              x1={terminalHole.point.x}
              y1={terminalHole.point.y - radius * 0.55}
              x2={terminalHole.point.x}
              y2={terminalHole.point.y + radius * 0.55}
              className="stitch-hole-terminal-cross"
            />
          </g>
        )
      })}

      {stitchSimulatorSettings?.showSimulatorPattern &&
        renderableTerminalHole &&
        renderableTerminalHole.endHole !== true && (
          <circle
            cx={renderableTerminalHole.point.x}
            cy={renderableTerminalHole.point.y}
            r={Math.max(
              1.6,
              createStitchHolePrimitive(renderableTerminalHole).kind === 'circle'
                ? (createStitchHolePrimitive(renderableTerminalHole) as Extract<ReturnType<typeof createStitchHolePrimitive>, { kind: 'circle' }>).radiusMm * 3
                : 2.8,
            )}
            fill="none"
            stroke={stitchSimulatorSettings.threadColor}
            strokeWidth={0.6}
            strokeDasharray="2 1.2"
            pointerEvents="none"
          />
        )}

      {renderableStitchHoles.map((stitchHole) => {
        const isSelected = stitchHole.id === selectedStitchHoleId
        const primitive = createStitchHolePrimitive(stitchHole)
        const r = primitive.kind === 'circle' ? primitive.radiusMm : stitchHole.diameterMm ? stitchHole.diameterMm / 2 : 0.6
        const outerR = r * 2.5
        const crossR = outerR * 1.3

        if (primitive.kind === 'segment') {
          return (
            <line
              key={stitchHole.id}
              x1={primitive.start.x}
              y1={primitive.start.y}
              x2={primitive.end.x}
              y2={primitive.end.y}
              className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
              strokeWidth={Math.max(0.6, primitive.strokeWidthMm)}
              onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)}
            />
          )
        }

        if (primitive.kind === 'polygon') {
          return (
            <polygon
              key={stitchHole.id}
              points={primitive.points.map((point) => `${point.x},${point.y}`).join(' ')}
              className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
              fill="none"
              strokeWidth={Math.max(0.6, stitchHole.widthMm ?? 0.9)}
              onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)}
            />
          )
        }

        const cx = stitchHole.point.x
        const cy = stitchHole.point.y

        return (
          <g key={stitchHole.id} onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={outerR} className="stitch-hole-outline" />
            <line x1={cx - crossR} y1={cy} x2={cx + crossR} y2={cy} className="stitch-hole-crosshair" />
            <line x1={cx} y1={cy - crossR} x2={cx} y2={cy + crossR} className="stitch-hole-crosshair" />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              className={isSelected ? 'stitch-hole-dot stitch-hole-dot-selected' : 'stitch-hole-dot'}
            />
            {showStitchSequenceLabels && viewportScale >= 0.55 && (
              <text x={cx + 3.2} y={cy - 3.2} className="stitch-hole-sequence-label">
                {stitchHole.sequence + 1}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}
