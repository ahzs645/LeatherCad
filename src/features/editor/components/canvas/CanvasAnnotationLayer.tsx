import { round } from '../../cad/cad-geometry'
import type { CanvasRenderEntity } from '../../render/canvas-render-model'
import { resolveAdaptiveTextFontSize } from './canvas-geometry'

type CanvasAnnotationLayerProps = {
  showAnnotations: boolean
  viewportScale: number
  pieceEdgeLabelEntities: Extract<CanvasRenderEntity, { kind: 'piece-edge-label' }>[]
  seamGuideEntities: Extract<CanvasRenderEntity, { kind: 'seam-guide' }>[]
  annotationLabelEntities: Extract<CanvasRenderEntity, { kind: 'annotation-label' }>[]
  dimensionLabelEntities: Extract<CanvasRenderEntity, { kind: 'dimension-label' }>[]
  dimensionLineEntities: Extract<CanvasRenderEntity, { kind: 'dimension-line' }>[]
  outlineChainLabelEntities: Extract<CanvasRenderEntity, { kind: 'outline-chain-label' }>[]
  constraintGlyphEntities: Extract<CanvasRenderEntity, { kind: 'constraint-glyph' }>[]
}

const DEFAULT_DIMENSION_LABEL_FONT_SIZE_MM = 3.5

export function CanvasAnnotationLayer({
  showAnnotations,
  viewportScale,
  pieceEdgeLabelEntities,
  seamGuideEntities,
  annotationLabelEntities,
  dimensionLabelEntities,
  dimensionLineEntities,
  outlineChainLabelEntities,
  constraintGlyphEntities,
}: CanvasAnnotationLayerProps) {
  const dimensionLabelStyle = (fontSizeMm = DEFAULT_DIMENSION_LABEL_FONT_SIZE_MM) => ({
    fontSize: `${resolveAdaptiveTextFontSize(fontSizeMm, viewportScale)}px`,
  })

  return (
    <>
      <g className="canvas-guide-layer">
        {seamGuideEntities.map((entry) => (
          <g key={entry.id}>
            <path d={entry.payload.d} className={entry.paint.lineClassName} />
            {showAnnotations && entry.paint.labelVisible && (
              <text x={entry.payload.labelPoint.x + 5} y={entry.payload.labelPoint.y + 5} className={entry.paint.labelClassName}>
                {entry.paint.labelText}
              </text>
            )}
          </g>
        ))}
        {pieceEdgeLabelEntities.map((entry) => (
          <g key={entry.id} style={{ pointerEvents: 'none' }}>
            <circle
              cx={entry.payload.x}
              cy={entry.payload.y}
              r={5.5}
              fill={entry.payload.active ? 'rgba(249, 115, 22, 0.92)' : 'rgba(15, 23, 42, 0.8)'}
              stroke={entry.payload.active ? '#fed7aa' : 'rgba(255,255,255,0.24)'}
              strokeWidth={0.7}
            />
            <text
              x={entry.payload.x}
              y={entry.payload.y + 0.4}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fill: '#f8fafc',
                fontSize: '5px',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >
              {entry.payload.label}
            </text>
          </g>
        ))}
      </g>

      {annotationLabelEntities.map((entry) => {
        const label = entry.payload
        return (
        <text
          key={label.id}
          x={label.point.x}
          y={label.point.y}
          className={entry.paint.className}
          style={label.fontSizeMm ? { fontSize: `${Math.max(4, label.fontSizeMm)}px` } : undefined}
          transform={label.rotationDeg ? `rotate(${round(label.rotationDeg)} ${label.point.x} ${label.point.y})` : undefined}
        >
          {label.text}
        </text>
        )
      })}

      {showAnnotations && outlineChainLabelEntities.map((entry) => {
        const { centroid, endpointRadius, first, labelSize, last, text } = entry.payload
        return (
          <g key={entry.id} className={entry.paint.className} style={{ pointerEvents: 'none' }}>
            <circle cx={first.x} cy={first.y} r={endpointRadius} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewportScale }} />
            <circle cx={last.x} cy={last.y} r={endpointRadius} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewportScale }} />
            <text
              x={centroid.x}
              y={centroid.y - 4 / viewportScale}
              style={{
                fontSize: labelSize,
                fill: '#f97316',
                fontWeight: 600,
                textAnchor: 'middle',
                opacity: 0.8,
              }}
            >
              {text}
            </text>
          </g>
        )
      })}

      {constraintGlyphEntities.map((entry) => (
        <text
          key={entry.id}
          x={entry.payload.glyphPoint.x}
          y={entry.payload.glyphPoint.y - 4}
          className={entry.paint.className}
          style={{
            fontSize: entry.payload.fontSizePx,
            fill: '#22d3ee',
            fontWeight: 700,
            textAnchor: 'middle',
            pointerEvents: 'none',
            opacity: entry.payload.opacity,
          }}
        >
          {entry.payload.glyph}
        </text>
      ))}

      {dimensionLabelEntities.map((entry) => (
        <text key={`dim-${entry.payload.id}`} x={entry.payload.x} y={entry.payload.y} className={entry.paint.className} style={dimensionLabelStyle(entry.payload.fontSizeMm)}>
          {entry.payload.text}
        </text>
      ))}

      {dimensionLineEntities.map((entry) => {
            const payload = entry.payload
            const dim = payload.dimension
            const label = payload.label
            return (
              <g key={`dimline-${dim.id}`} className={entry.paint.groupClassName}>
                <line x1={payload.extensionStart.x} y1={payload.extensionStart.y} x2={payload.measureStart.x} y2={payload.measureStart.y} className={entry.paint.extensionClassName} />
                <line x1={payload.extensionEnd.x} y1={payload.extensionEnd.y} x2={payload.measureEnd.x} y2={payload.measureEnd.y} className={entry.paint.extensionClassName} />
                {payload.firstMeasureEnd && payload.secondMeasureStart ? (
                  <>
                    <line
                      x1={payload.measureStart.x} y1={payload.measureStart.y} x2={payload.firstMeasureEnd.x} y2={payload.firstMeasureEnd.y}
                      className={entry.paint.measureClassName}
                      style={{ markerStart: 'url(#arrow-start)' }}
                    />
                    <line
                      x1={payload.secondMeasureStart.x} y1={payload.secondMeasureStart.y} x2={payload.measureEnd.x} y2={payload.measureEnd.y}
                      className={entry.paint.measureClassName}
                      style={{ markerEnd: 'url(#arrow-end)' }}
                    />
                  </>
                ) : (
                  <line
                    x1={payload.measureStart.x} y1={payload.measureStart.y} x2={payload.measureEnd.x} y2={payload.measureEnd.y}
                    className={entry.paint.measureClassName}
                    style={{ markerStart: 'url(#arrow-start)', markerEnd: 'url(#arrow-end)' }}
                  />
                )}
                {label ? (
                  <text
                    x={label.point.x}
                    y={label.point.y}
                    textAnchor={label.center ? 'middle' : undefined}
                    dominantBaseline={label.center ? 'middle' : undefined}
                    className={entry.paint.labelClassName}
                    style={dimensionLabelStyle(label.fontSizeMm)}
                    transform={
                      label.rotationDeg
                        ? `rotate(${round(label.rotationDeg)} ${round(label.point.x)} ${round(label.point.y)})`
                        : undefined
                    }
                  >
                    {label.text}
                  </text>
                ) : null}
              </g>
            )
          })}
    </>
  )
}
