import { describe, expect, it } from 'vitest'
import type { LineShape, LineType, Point, Shape } from '../cad/cad-types'
import { polygonArea } from '../ops/polygon-ops'
import { buildPhysicalLayerRegions } from './physical-layer-regions'

function line(
  id: string,
  lineTypeId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): LineShape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

function polygonBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )
}

describe('buildPhysicalLayerRegions', () => {
  it('reconstructs a filled outer region from cut and fold edges, then preserves internal holes', () => {
    const lineTypes: LineType[] = [
      {
        id: 'cut',
        name: 'Cut',
        role: 'cut',
        style: 'solid',
        color: '#00ffff',
        visible: true,
      },
      {
        id: 'fold',
        name: 'Fold',
        role: 'fold',
        style: 'dashed',
        color: '#ffc0cb',
        visible: true,
      },
    ]

    const holeOutline = [
      { x: 90, y: 7.5 },
      { x: 93, y: 7.5 },
      { x: 93, y: 10.5 },
      { x: 90, y: 10.5 },
    ]

    const shapes: Shape[] = [
      line('cut-1', 'cut', 0, 0, 0, 18),
      line('cut-2', 'cut', 22, 3, 22, 0),
      line('cut-3', 'cut', 22, 18, 22, 15),
      line('cut-4', 'cut', 0, -5, 0, 0),
      line('cut-5', 'cut', 22, -5, 0, -5),
      line('cut-6', 'cut', 22, 0, 22, -5),
      line('cut-7', 'cut', 0, 18, 0, 23),
      line('cut-8', 'cut', 0, 23, 22, 23),
      line('cut-9', 'cut', 22, 23, 22, 18),
      line('cut-10', 'cut', 34, 15, 34, 20),
      line('cut-11', 'cut', 34, 20, 22, 20),
      line('cut-12', 'cut', 34, -2, 34, 3),
      line('cut-13', 'cut', 22, -2, 34, -2),
      line('cut-14', 'cut', 34, 3, 43, 3),
      line('cut-15', 'cut', 43, 15, 34, 15),
      line('cut-16', 'cut', 43, 3, 55, 3),
      line('cut-17', 'cut', 55, 15, 43, 15),
      line('cut-18', 'cut', 55, 3, 55, 0),
      line('cut-19', 'cut', 55, 18, 55, 15),
      line('cut-20', 'cut', 55, 0, 77, 0),
      line('cut-21', 'cut', 77, 0, 88, 0),
      line('cut-22', 'cut', 88, 0, 95, 0),
      line('cut-23', 'cut', 95, 18, 88, 18),
      line('cut-24', 'cut', 77, 18, 55, 18),
      line('cut-25', 'cut', 88, 18, 77, 18),
      line('cut-26', 'cut', 95, 0, 108, 0),
      line('cut-27', 'cut', 108, 18, 95, 18),
      line('cut-28', 'cut', 108, 0, 111, 3),
      line('cut-29', 'cut', 111, 15, 108, 18),
      line('cut-30', 'cut', 119, 15, 111, 15),
      line('cut-31', 'cut', 121, 13, 119, 15),
      line('cut-32', 'cut', 121, 5, 121, 13),
      line('cut-33', 'cut', 119, 3, 121, 5),
      line('cut-34', 'cut', 111, 3, 119, 3),
      line('hole-1', 'cut', 90, 7.5, 93, 7.5),
      line('hole-2', 'cut', 93, 7.5, 93, 10.5),
      line('hole-3', 'cut', 93, 10.5, 90, 10.5),
      line('hole-4', 'cut', 90, 10.5, 90, 7.5),
      line('fold-1', 'fold', 0, 0, 22, 0),
      line('fold-2', 'fold', 0, 18, 22, 18),
      line('fold-3', 'fold', 22, 3, 34, 3),
      line('fold-4', 'fold', 34, 15, 22, 15),
    ]

    const regions = buildPhysicalLayerRegions({
      layerId: 'layer-1',
      shapes,
      lineTypeById: new Map(lineTypes.map((lineType) => [lineType.id, lineType])),
      closedCutOutlines: [{ polygon: holeOutline }],
    })

    expect(regions).toHaveLength(1)
    expect(regions[0].holes).toHaveLength(1)

    const outerBounds = polygonBounds(regions[0].outer)
    expect(outerBounds).toEqual({
      minX: 0,
      minY: -5,
      maxX: 121,
      maxY: 23,
    })

    expect(Math.abs(polygonArea(regions[0].outer))).toBeCloseTo(2247, 6)
    expect(Math.abs(polygonArea(regions[0].holes[0]))).toBeCloseTo(9, 6)
  })
})
