/**
 * Parametric outlines for the pieces an agent can ask for by name.
 *
 * An agent driving a CAD canvas through raw coordinates spends most of its
 * budget getting a rounded corner to close, and a boundary that fails to close
 * is a piece the app cannot cut, measure or nest. So the shapes a leatherworker
 * actually names — a rounded panel, a strap, a card slot — are constructed here
 * from dimensions instead, and the agent supplies the millimetres.
 *
 * Every outline is emitted as an ordered ring of segments that meet end to end,
 * which is what `detectOutlines` needs to resolve them into one closed chain.
 * Coordinates are millimetres with x to the right and y downwards, matching the
 * rest of the editor, and each outline is built centred on the origin and then
 * translated so callers can place a piece by its centre.
 */

import type { Point } from '../cad/cad-types'

export type OutlineSegment =
  | { kind: 'line'; start: Point; end: Point }
  | { kind: 'arc'; start: Point; mid: Point; end: Point }
  | { kind: 'bezier'; start: Point; control: Point; end: Point }

export const PIECE_SHAPE_KINDS = ['rounded_rect', 'strap', 'card_slot', 'circle'] as const
export type PieceShapeKind = (typeof PIECE_SHAPE_KINDS)[number]

export type OutlineParams = {
  kind: PieceShapeKind
  widthMm: number
  heightMm: number
  cornerRadiusMm: number
  /** Straps only: how the far end of the strap is finished. */
  strapEnd: 'round' | 'point' | 'square'
  /** Card slots only: how far the mouth dips below the top edge. */
  scoopMm: number
}

function translate(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy }
}

/**
 * A quarter-turn arc between two points, bulging away from its centre. The
 * editor stores arcs as start/mid/end, so the midpoint is placed on the
 * bisector at the radius rather than left to be inferred.
 */
function quarterArc(start: Point, end: Point, center: Point, radius: number): OutlineSegment {
  const dirX = (start.x + end.x) / 2 - center.x
  const dirY = (start.y + end.y) / 2 - center.y
  const length = Math.hypot(dirX, dirY) || 1
  return {
    kind: 'arc',
    start,
    end,
    mid: {
      x: center.x + (dirX / length) * radius,
      y: center.y + (dirY / length) * radius,
    },
  }
}

function roundedRectSegments(width: number, height: number, radius: number): OutlineSegment[] {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const r = Math.min(Math.max(radius, 0), Math.min(halfWidth, halfHeight))
  const minX = -halfWidth
  const maxX = halfWidth
  const minY = -halfHeight
  const maxY = halfHeight

  if (r <= 1e-6) {
    return [
      { kind: 'line', start: { x: minX, y: minY }, end: { x: maxX, y: minY } },
      { kind: 'line', start: { x: maxX, y: minY }, end: { x: maxX, y: maxY } },
      { kind: 'line', start: { x: maxX, y: maxY }, end: { x: minX, y: maxY } },
      { kind: 'line', start: { x: minX, y: maxY }, end: { x: minX, y: minY } },
    ]
  }

  const topRight = { x: maxX - r, y: minY + r }
  const bottomRight = { x: maxX - r, y: maxY - r }
  const bottomLeft = { x: minX + r, y: maxY - r }
  const topLeft = { x: minX + r, y: minY + r }

  return [
    { kind: 'line', start: { x: minX + r, y: minY }, end: { x: maxX - r, y: minY } },
    quarterArc({ x: maxX - r, y: minY }, { x: maxX, y: minY + r }, topRight, r),
    { kind: 'line', start: { x: maxX, y: minY + r }, end: { x: maxX, y: maxY - r } },
    quarterArc({ x: maxX, y: maxY - r }, { x: maxX - r, y: maxY }, bottomRight, r),
    { kind: 'line', start: { x: maxX - r, y: maxY }, end: { x: minX + r, y: maxY } },
    quarterArc({ x: minX + r, y: maxY }, { x: minX, y: maxY - r }, bottomLeft, r),
    { kind: 'line', start: { x: minX, y: maxY - r }, end: { x: minX, y: minY + r } },
    quarterArc({ x: minX, y: minY + r }, { x: minX + r, y: minY }, topLeft, r),
  ]
}

function circleSegments(diameter: number): OutlineSegment[] {
  const r = diameter / 2
  return [
    {
      kind: 'arc',
      start: { x: -r, y: 0 },
      mid: { x: 0, y: -r },
      end: { x: r, y: 0 },
    },
    {
      kind: 'arc',
      start: { x: r, y: 0 },
      mid: { x: 0, y: r },
      end: { x: -r, y: 0 },
    },
  ]
}

/** A strap: parallel sides, with the top end finished square, round or pointed. */
function strapSegments(width: number, length: number, end: OutlineParams['strapEnd']): OutlineSegment[] {
  if (end === 'round') {
    return roundedRectSegments(width, length, width / 2)
  }
  if (end === 'square') {
    return roundedRectSegments(width, length, 0)
  }

  const halfWidth = width / 2
  const halfLength = length / 2
  // The point is an isosceles tip half a strap-width deep, the proportion a
  // belt tip or a buckle strap is normally cut to.
  const tipDepth = Math.min(halfWidth, length / 2)
  return [
    { kind: 'line', start: { x: -halfWidth, y: -halfLength + tipDepth }, end: { x: 0, y: -halfLength } },
    { kind: 'line', start: { x: 0, y: -halfLength }, end: { x: halfWidth, y: -halfLength + tipDepth } },
    { kind: 'line', start: { x: halfWidth, y: -halfLength + tipDepth }, end: { x: halfWidth, y: halfLength } },
    { kind: 'line', start: { x: halfWidth, y: halfLength }, end: { x: -halfWidth, y: halfLength } },
    { kind: 'line', start: { x: -halfWidth, y: halfLength }, end: { x: -halfWidth, y: -halfLength + tipDepth } },
  ]
}

/**
 * A card slot panel: a rectangle whose top edge dips into the piece so a card
 * can be thumbed out. The dip is a quadratic bezier, which at its midpoint sits
 * exactly `scoop` below the top edge.
 */
function cardSlotSegments(width: number, height: number, scoop: number): OutlineSegment[] {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const depth = Math.min(Math.max(scoop, 0), height * 0.8)
  return [
    {
      kind: 'bezier',
      start: { x: -halfWidth, y: -halfHeight },
      control: { x: 0, y: -halfHeight + depth * 2 },
      end: { x: halfWidth, y: -halfHeight },
    },
    { kind: 'line', start: { x: halfWidth, y: -halfHeight }, end: { x: halfWidth, y: halfHeight } },
    { kind: 'line', start: { x: halfWidth, y: halfHeight }, end: { x: -halfWidth, y: halfHeight } },
    { kind: 'line', start: { x: -halfWidth, y: halfHeight }, end: { x: -halfWidth, y: -halfHeight } },
  ]
}

function segmentsFor(params: OutlineParams): OutlineSegment[] {
  switch (params.kind) {
    case 'circle':
      return circleSegments(params.widthMm)
    case 'strap':
      return strapSegments(params.widthMm, params.heightMm, params.strapEnd)
    case 'card_slot':
      return cardSlotSegments(params.widthMm, params.heightMm, params.scoopMm)
    case 'rounded_rect':
    default:
      return roundedRectSegments(params.widthMm, params.heightMm, params.cornerRadiusMm)
  }
}

export function buildOutline(params: OutlineParams, center: Point = { x: 0, y: 0 }): OutlineSegment[] {
  return segmentsFor(params).map((segment) => {
    if (segment.kind === 'line') {
      return {
        kind: 'line' as const,
        start: translate(segment.start, center.x, center.y),
        end: translate(segment.end, center.x, center.y),
      }
    }
    if (segment.kind === 'arc') {
      return {
        kind: 'arc' as const,
        start: translate(segment.start, center.x, center.y),
        mid: translate(segment.mid, center.x, center.y),
        end: translate(segment.end, center.x, center.y),
      }
    }
    return {
      kind: 'bezier' as const,
      start: translate(segment.start, center.x, center.y),
      control: translate(segment.control, center.x, center.y),
      end: translate(segment.end, center.x, center.y),
    }
  })
}

/**
 * The stitch line that runs parallel to a cut edge, `insetMm` inside it.
 *
 * Built by shrinking the same construction rather than by offsetting the
 * resolved polygon: the outline is defined by its dimensions, so taking the
 * inset off each side and off the corner radius gives a true parallel run on
 * every shape with a constant-radius corner. On a card slot's scooped mouth
 * the dip is carried across unchanged, which is a close approximation for the
 * shallow scoops this shape is for and always stays inside the cut edge.
 *
 * Returns null when the inset would consume the piece.
 */
export function buildStitchOutline(
  params: OutlineParams,
  insetMm: number,
  center: Point = { x: 0, y: 0 },
): OutlineSegment[] | null {
  if (insetMm <= 0) {
    return null
  }
  const width = params.widthMm - insetMm * 2
  const height = params.kind === 'circle' ? width : params.heightMm - insetMm * 2
  if (width <= 0.5 || height <= 0.5) {
    return null
  }
  return buildOutline(
    {
      ...params,
      widthMm: width,
      heightMm: height,
      cornerRadiusMm: Math.max(0, params.cornerRadiusMm - insetMm),
      scoopMm: params.scoopMm,
    },
    center,
  )
}
