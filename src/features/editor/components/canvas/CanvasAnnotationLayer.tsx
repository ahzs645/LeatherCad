import { round } from '../../cad/cad-geometry'
import { formatDisplayDistance, type DisplayUnit } from '../../ops/unit-ops'
import type { Bounds } from './canvas-geometry'
import { boundsIntersect, pointInBounds, resolveAdaptiveTextFontSize } from './canvas-geometry'

type DimensionLine = import('../../cad/cad-types').DimensionLine

type CanvasAnnotationLayerProps = {
  seamGuides: import('../../editor-types').SeamGuide[]
  showAnnotations: boolean
  viewportScale: number
  viewBounds: Bounds
  detailPadding: number
  renderablePieceEdgeLabels: Array<{ id: string; x: number; y: number; label: string; active: boolean }>
  renderableAnnotationLabels: import('../../editor-types').AnnotationLabel[]
  renderableOutlineChains: import('../../ops/outline-detection').OutlineChain[]
  renderableConstraintSuggestions: import('../../ops/auto-constraint-ops').ConstraintSuggestion[]
  dimensionEntries: Array<{ id: string; x: number; y: number; text: string }>
  showDimensions: boolean
  dimensionLines: DimensionLine[]
  displayUnit: DisplayUnit
}

const DEFAULT_DIMENSION_LABEL_FONT_SIZE_MM = 3.5

function pointAlong(from: { x: number; y: number }, to: { x: number; y: number }, distance: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { ...from }
  }

  const ratio = Math.max(0, Math.min(1, distance / length))
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  }
}

function dimensionLineBounds(dim: DimensionLine): Bounds {
  const dx = dim.end.x - dim.start.x
  const dy = dim.end.y - dim.start.y
  const len = Math.hypot(dx, dy)
  if (len < 0.01) {
    return {
      minX: dim.start.x,
      minY: dim.start.y,
      maxX: dim.start.x,
      maxY: dim.start.y,
    }
  }

  const nx = (-dy / len) * dim.offsetMm
  const ny = (dx / len) * dim.offsetMm
  const points = [
    dim.start,
    dim.end,
    { x: dim.start.x + nx, y: dim.start.y + ny },
    { x: dim.end.x + nx, y: dim.end.y + ny },
    ...(dim.labelPoint ? [dim.labelPoint] : []),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export function CanvasAnnotationLayer({
  seamGuides,
  showAnnotations,
  viewportScale,
  viewBounds,
  detailPadding,
  renderablePieceEdgeLabels,
  renderableAnnotationLabels,
  renderableOutlineChains,
  renderableConstraintSuggestions,
  dimensionEntries,
  showDimensions,
  dimensionLines,
  displayUnit,
}: CanvasAnnotationLayerProps) {
  const dimensionLabelStyle = (fontSizeMm = DEFAULT_DIMENSION_LABEL_FONT_SIZE_MM) => ({
    fontSize: `${resolveAdaptiveTextFontSize(fontSizeMm, viewportScale)}px`,
  })

  return (
    <>
      <g className="canvas-guide-layer">
        {seamGuides.map((guide) => (
          <g key={guide.id}>
            <path d={guide.d} className="seam-guide-line" />
            {showAnnotations && viewportScale >= 0.35 && pointInBounds(guide.labelPoint, viewBounds, detailPadding) && (
              <text x={guide.labelPoint.x + 5} y={guide.labelPoint.y + 5} className="seam-guide-label">
                {`${guide.offsetMm.toFixed(1)}mm seam`}
              </text>
            )}
          </g>
        ))}
        {renderablePieceEdgeLabels.map((entry) => (
          <g key={entry.id} style={{ pointerEvents: 'none' }}>
            <circle
              cx={entry.x}
              cy={entry.y}
              r={5.5}
              fill={entry.active ? 'rgba(249, 115, 22, 0.92)' : 'rgba(15, 23, 42, 0.8)'}
              stroke={entry.active ? '#fed7aa' : 'rgba(255,255,255,0.24)'}
              strokeWidth={0.7}
            />
            <text
              x={entry.x}
              y={entry.y + 0.4}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fill: '#f8fafc',
                fontSize: '5px',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >
              {entry.label}
            </text>
          </g>
        ))}
      </g>

      {renderableAnnotationLabels.map((label) => (
        <text
          key={label.id}
          x={label.point.x}
          y={label.point.y}
          className="annotation-label"
          style={label.fontSizeMm ? { fontSize: `${Math.max(4, label.fontSizeMm)}px` } : undefined}
          transform={label.rotationDeg ? `rotate(${round(label.rotationDeg)} ${label.point.x} ${label.point.y})` : undefined}
        >
          {label.text}
        </text>
      ))}

      {showAnnotations && typeof window !== 'undefined' && window.localStorage?.getItem('leathercad_show_open_path_labels') === '1' && renderableOutlineChains.map((chain) => {
        const centroid = chain.polygon.reduce(
          (acc, point) => ({ x: acc.x + point.x / chain.polygon.length, y: acc.y + point.y / chain.polygon.length }),
          { x: 0, y: 0 },
        )
        const labelSize = 3.5 / viewportScale
        if (chain.isClosed) return null
        const first = chain.polygon[0]
        const last = chain.polygon[chain.polygon.length - 1]
        const endpointR = 2 / viewportScale
        return (
          <g key={`outline-${chain.id}`} className="outline-chain-label" style={{ pointerEvents: 'none' }}>
            <circle cx={first.x} cy={first.y} r={endpointR} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewportScale }} />
            <circle cx={last.x} cy={last.y} r={endpointR} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewportScale }} />
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
              Open Path
            </text>
          </g>
        )
      })}

      {renderableConstraintSuggestions.map((suggestion, index) => (
        <text
          key={`cs-${index}`}
          x={suggestion.glyphPoint.x}
          y={suggestion.glyphPoint.y - 4}
          className="constraint-glyph"
          style={{
            fontSize: 10 / viewportScale,
            fill: '#22d3ee',
            fontWeight: 700,
            textAnchor: 'middle',
            pointerEvents: 'none',
            opacity: 0.5 + suggestion.confidence * 0.5,
          }}
        >
          {suggestion.glyph}
        </text>
      ))}

      {dimensionEntries.map((entry) => (
        <text key={`dim-${entry.id}`} x={entry.x} y={entry.y} className="dimension-label" style={dimensionLabelStyle()}>
          {entry.text}
        </text>
      ))}

      {showDimensions &&
        dimensionLines
          .filter((dim) => boundsIntersect(dimensionLineBounds(dim), viewBounds, detailPadding))
          .map((dim) => {
            const dx = dim.end.x - dim.start.x
            const dy = dim.end.y - dim.start.y
            const len = Math.hypot(dx, dy)
            if (len < 0.01) return null
            const nx = (-dy / len) * dim.offsetMm
            const ny = (dx / len) * dim.offsetMm
            const s = { x: dim.start.x + nx, y: dim.start.y + ny }
            const e = { x: dim.end.x + nx, y: dim.end.y + ny }
            const mx = (s.x + e.x) / 2
            const my = (s.y + e.y) / 2
            const precision =
              typeof dim.precision === 'number' && Number.isFinite(dim.precision) && dim.precision >= 0
                ? Math.min(6, Math.floor(dim.precision))
                : displayUnit === 'in'
                  ? 3
                  : 1
            const dimText = dim.text ?? formatDisplayDistance(len, displayUnit, precision)
            const dimensionTextSizeMm = dim.fontSizeMm ?? DEFAULT_DIMENSION_LABEL_FONT_SIZE_MM
            const measureLen = Math.hypot(e.x - s.x, e.y - s.y)
            const labelGapMm = Math.min(
              Math.max(0, measureLen - 2),
              Math.max(dimensionTextSizeMm * 2.4, dimText.length * dimensionTextSizeMm * 0.62 + dimensionTextSizeMm * 1.2),
            )
            const halfGapMm = labelGapMm / 2
            const arrowOnly = dim.arrowOnly === true
            const textInside = dim.textInside !== false
            const singleLine = dim.singleLine === true
            const canGapMeasureLine = !singleLine && !arrowOnly && textInside && measureLen > labelGapMm + 2
            const firstMeasureEnd = canGapMeasureLine ? pointAlong(s, e, measureLen / 2 - halfGapMm) : null
            const secondMeasureStart = canGapMeasureLine ? pointAlong(s, e, measureLen / 2 + halfGapMm) : null
            const hasAuthoredLabelPlacement = Boolean(dim.labelPoint)
            const baseLabelPoint = dim.labelPoint ?? { x: mx, y: my }
            const outsideOffsetMm = dimensionTextSizeMm * 1.4
            const labelPoint =
              !textInside && !hasAuthoredLabelPlacement
                ? {
                    x: mx + (-dy / len) * (dim.offsetMm > 0 ? outsideOffsetMm : -outsideOffsetMm),
                    y: my + (dx / len) * (dim.offsetMm > 0 ? outsideOffsetMm : -outsideOffsetMm),
                  }
                : baseLabelPoint
            const labelRotationDeg = dim.labelRotationDeg ?? 0
            const reverseRotation = dim.textReverse ? 180 : 0
            const effectiveLabelRotation = labelRotationDeg + reverseRotation
            const centerLabel = !hasAuthoredLabelPlacement || dim.labelPlacement === 'center'
            return (
              <g key={`dimline-${dim.id}`} className="dimension-line-group">
                <line x1={dim.start.x} y1={dim.start.y} x2={s.x} y2={s.y} className="dimension-extension-line" />
                <line x1={dim.end.x} y1={dim.end.y} x2={e.x} y2={e.y} className="dimension-extension-line" />
                {canGapMeasureLine && firstMeasureEnd && secondMeasureStart ? (
                  <>
                    <line
                      x1={s.x} y1={s.y} x2={firstMeasureEnd.x} y2={firstMeasureEnd.y}
                      className="dimension-measure-line"
                      style={{ markerStart: 'url(#arrow-start)' }}
                    />
                    <line
                      x1={secondMeasureStart.x} y1={secondMeasureStart.y} x2={e.x} y2={e.y}
                      className="dimension-measure-line"
                      style={{ markerEnd: 'url(#arrow-end)' }}
                    />
                  </>
                ) : (
                  <line
                    x1={s.x} y1={s.y} x2={e.x} y2={e.y}
                    className="dimension-measure-line"
                    style={{ markerStart: 'url(#arrow-start)', markerEnd: 'url(#arrow-end)' }}
                  />
                )}
                {arrowOnly ? null : (
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor={centerLabel ? 'middle' : undefined}
                    dominantBaseline={centerLabel ? 'middle' : undefined}
                    className="dimension-label"
                    style={dimensionLabelStyle(dimensionTextSizeMm)}
                    transform={
                      effectiveLabelRotation
                        ? `rotate(${round(effectiveLabelRotation)} ${round(labelPoint.x)} ${round(labelPoint.y)})`
                        : undefined
                    }
                  >
                    {dimText}
                  </text>
                )}
              </g>
            )
          })}
    </>
  )
}
