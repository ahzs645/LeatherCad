import type { PointerEvent } from 'react'
import type {
  FoldLine,
  TextShape,
} from '../../cad/cad-types'
import type { PiecePlacementGuide } from '../../editor-types'
import type { HandlePointKey } from '../../hooks/useCanvasInteractions'
import type { CanvasRenderShapeEntity } from '../../render/canvas-render-model'
import { renderCanvasShape } from './canvas-shape-rendering'
import { shapeHandleEntries } from './canvas-geometry'

type CanvasShapeLayerProps = {
  linkedShapeEntities: CanvasRenderShapeEntity[]
  editableShapeEntities: CanvasRenderShapeEntity[]
  previewShapeEntities: CanvasRenderShapeEntity[]
  selectedShapeIdSet: Set<string>
  onShapePointerDown: (event: PointerEvent<SVGElement>, shapeId: string) => void
  showShapeHandles: boolean
  onShapeHandlePointerDown: (
    event: PointerEvent<SVGCircleElement>,
    shapeId: string,
    pointKey: HandlePointKey,
  ) => void
  onShapeHandleDoubleClick?: (shapeId: string, pointKey: HandlePointKey) => void
  renderableFoldLines: FoldLine[]
  renderablePieceGrainlineSegments: Array<{ pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point }>
  renderablePieceNotchLines: Array<{ id: string; pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point; showOnSeam: boolean }>
  renderablePlacementGuides: PiecePlacementGuide[]
  viewportScale: number
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function CanvasShapeLayer({
  linkedShapeEntities,
  editableShapeEntities,
  previewShapeEntities,
  selectedShapeIdSet,
  onShapePointerDown,
  showShapeHandles,
  onShapeHandlePointerDown,
  onShapeHandleDoubleClick,
  renderableFoldLines,
  renderablePieceGrainlineSegments,
  renderablePieceNotchLines,
  renderablePlacementGuides,
  viewportScale,
  buildTextGlyphPlacements,
  normalizeTextShape,
  textBaselineAngleDeg,
}: CanvasShapeLayerProps) {
  return (
    <>
      <g className="canvas-linked-geometry-layer">
        {linkedShapeEntities.map((entity) => {
          return renderCanvasShape(entity.shape, {
            key: entity.id,
            className: entity.paint.className,
            color: entity.paint.strokeColor,
            strokeDasharray: entity.paint.strokeDasharray,
            opacity: entity.paint.opacity,
            interactive: entity.paint.interactive,
            onShapePointerDown,
            buildTextGlyphPlacements,
            normalizeTextShape,
            textBaselineAngleDeg,
            strokeWidthMm: entity.paint.strokeWidthMm,
            viewportScale,
          })
        })}
      </g>

      <g className="canvas-editable-geometry-layer">
        {editableShapeEntities.map((entity) => {
          return renderCanvasShape(entity.shape, {
            key: entity.id,
            className: entity.paint.className,
            color: entity.paint.strokeColor,
            strokeDasharray: entity.paint.strokeDasharray,
            opacity: entity.paint.opacity,
            interactive: entity.paint.interactive,
            onShapePointerDown,
            buildTextGlyphPlacements,
            normalizeTextShape,
            textBaselineAngleDeg,
            strokeWidthMm: entity.paint.strokeWidthMm,
            viewportScale,
          })
        })}
      </g>

      {showShapeHandles && (
        <g className="canvas-handle-layer">
          {editableShapeEntities
            .filter((entity) => selectedShapeIdSet.has(entity.id) && !entity.paint.previewSource)
            .flatMap((entity) =>
              shapeHandleEntries(entity.shape).map((entry) => (
                <circle
                  key={`${entity.id}-${entry.key}-handle`}
                  cx={entry.point.x}
                  cy={entry.point.y}
                  r={2.3}
                  className="shape-handle"
                  onPointerDown={(event) => onShapeHandlePointerDown(event, entity.id, entry.key)}
                  onDoubleClick={() => onShapeHandleDoubleClick?.(entity.id, entry.key)}
                />
              )),
            )}
          {previewShapeEntities
            .filter((entity) => selectedShapeIdSet.has(entity.id))
            .flatMap((entity) =>
              shapeHandleEntries(entity.shape).map((entry) => (
                <circle
                  key={`${entity.id}-${entry.key}-preview-handle`}
                  cx={entry.point.x}
                  cy={entry.point.y}
                  r={2.3}
                  className="shape-handle shape-handle-preview"
                  onPointerDown={(event) => onShapeHandlePointerDown(event, entity.id, entry.key)}
                  onDoubleClick={() => onShapeHandleDoubleClick?.(entity.id, entry.key)}
                />
              )),
            )}
        </g>
      )}

      {renderableFoldLines.map((foldLine) => (
        <line
          key={foldLine.id}
          x1={foldLine.start.x}
          y1={foldLine.start.y}
          x2={foldLine.end.x}
          y2={foldLine.end.y}
          className="fold-line"
        />
      ))}

      {renderablePieceGrainlineSegments.map((segment) => (
        <g key={`piece-grainline-${segment.pieceId}`} className="piece-grainline" style={{ pointerEvents: 'none' }}>
          <line
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            stroke="#0f766e"
            strokeWidth={1.25 / viewportScale}
            strokeDasharray={`${6 / viewportScale} ${4 / viewportScale}`}
          />
          <polyline
            points={`${segment.end.x},${segment.end.y} ${segment.end.x - 3 / viewportScale},${segment.end.y - 1.5 / viewportScale} ${segment.end.x - 3 / viewportScale},${segment.end.y + 1.5 / viewportScale}`}
            fill="none"
            stroke="#0f766e"
            strokeWidth={1.25 / viewportScale}
          />
        </g>
      ))}

      {renderablePieceNotchLines.map((notch) => (
        <line
          key={notch.id}
          x1={notch.start.x}
          y1={notch.start.y}
          x2={notch.end.x}
          y2={notch.end.y}
          stroke={notch.showOnSeam ? '#7c2d12' : '#0f172a'}
          strokeWidth={1.4 / viewportScale}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {renderablePlacementGuides.map((guide) => {
        const radians = (guide.rotationDeg * Math.PI) / 180
        const halfWidth = guide.widthMm / 2
        const halfHeight = guide.heightMm / 2
        const rotatePoint = (x: number, y: number) => ({
          x: guide.point.x + x * Math.cos(radians) - y * Math.sin(radians),
          y: guide.point.y + x * Math.sin(radians) + y * Math.cos(radians),
        })

        if (guide.kind === 'text') {
          return (
            <text
              key={guide.id}
              x={guide.point.x}
              y={guide.point.y}
              className="annotation-label"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${Math.round(guide.rotationDeg * 1000) / 1000} ${guide.point.x} ${guide.point.y})`}
              style={{ pointerEvents: 'none', fontSize: `${Math.max(4, guide.heightMm)}px` }}
            >
              {guide.text ?? guide.id}
            </text>
          )
        }

        if (guide.kind === 'circle') {
          return (
            <circle
              key={guide.id}
              cx={guide.point.x}
              cy={guide.point.y}
              r={Math.max(1, halfWidth)}
              stroke="#1d4ed8"
              fill="none"
              strokeWidth={1.2 / viewportScale}
              style={{ pointerEvents: 'none' }}
            />
          )
        }

        if (guide.kind === 'box') {
          const corners = [
            rotatePoint(-halfWidth, -halfHeight),
            rotatePoint(halfWidth, -halfHeight),
            rotatePoint(halfWidth, halfHeight),
            rotatePoint(-halfWidth, halfHeight),
          ]
          return (
            <polygon
              key={guide.id}
              points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
              stroke="#1d4ed8"
              fill="none"
              strokeWidth={1.2 / viewportScale}
              style={{ pointerEvents: 'none' }}
            />
          )
        }

        const horizontalStart = rotatePoint(-halfWidth, 0)
        const horizontalEnd = rotatePoint(halfWidth, 0)
        const verticalStart = rotatePoint(0, -halfHeight)
        const verticalEnd = rotatePoint(0, halfHeight)
        return (
          <g key={guide.id} style={{ pointerEvents: 'none' }}>
            <line
              x1={horizontalStart.x}
              y1={horizontalStart.y}
              x2={horizontalEnd.x}
              y2={horizontalEnd.y}
              stroke="#1d4ed8"
              strokeWidth={1.2 / viewportScale}
            />
            <line
              x1={verticalStart.x}
              y1={verticalStart.y}
              x2={verticalEnd.x}
              y2={verticalEnd.y}
              stroke="#1d4ed8"
              strokeWidth={1.2 / viewportScale}
            />
          </g>
        )
      })}
    </>
  )
}
