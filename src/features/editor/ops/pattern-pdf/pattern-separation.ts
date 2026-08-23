/**
 * Separates a sheet of PDF vector paths into pattern pieces.
 *
 * A leathercraft template PDF is one page holding several unrelated things:
 * piece outlines, punch marks, hardware holes, a maker's logo, print-scale
 * warnings, and the clip rectangle the page itself is drawn inside. Nothing in
 * the file says which is which — Illustrator emits them all as anonymous paths
 * in one stream — so the split has to come from geometry.
 *
 * The rules, in order:
 *
 * 1. A closed subpath enclosing at least `minPieceAreaMm2` is an *outline*.
 *    That threshold is what keeps a logo, a glyph, and a callout arrow from
 *    being read as pieces.
 * 2. A closed subpath small enough to be a punch and round enough to be one is
 *    a *dot*. Roundness is measured, not assumed: a glyph counter and a slot
 *    are punch-sized too, and neither is a hole.
 * 3. An outline strictly inside another outline is a cutout of it — a window,
 *    a card slot, a strap slot — not a piece of its own.
 * 4. Everything else is decorative and named as such rather than dropped, so a
 *    caller can show the user what was ignored.
 *
 * Dots stay unclassified here. Whether one is a stitch hole or a rivet hole is
 * a question about its *neighbours*, and that is `stitch-pattern-detection`'s
 * job.
 */

import { pointInPolygon } from '@atelier/geometry'

import type { Point } from '../../cad/cad-types'
import { polygonArea, polygonBounds } from '../polygon-ops'
import type { PdfPaint, PdfPathSegment, PdfSubpath, PdfVectorPath } from './pdf-vector-paths'

export type PatternSeparationOptions = {
  /** Smallest enclosed area that counts as a pattern piece. */
  minPieceAreaMm2: number
  /** Largest across-the-bbox size a punch mark may have. */
  maxDotDiameterMm: number
  /**
   * Lowest isoperimetric ratio (4πA/P²) a dot may have. A circle scores 1, a
   * 2:1 slot 0.85, a square 0.79, a 3:1 slot 0.69 — so this admits round,
   * rounded, and oval punches while rejecting glyph fragments and long slots.
   *
   * Deliberately permissive: a mark that is round enough to reach the next
   * stage still has to fall into a run of evenly spaced neighbours before it
   * counts as stitching, and that test is far harder to pass by accident.
   */
  minDotRoundness: number
}

export const DEFAULT_SEPARATION_OPTIONS: PatternSeparationOptions = {
  minPieceAreaMm2: 400,
  maxDotDiameterMm: 8,
  minDotRoundness: 0.7,
}

export type PatternBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/** A round punch mark: a stitch hole, a rivet hole, or a snap post hole. */
export type PatternDot = {
  id: string
  center: Point
  diameterMm: number
  /** Filled dots are printed guides; stroked ones are cut. */
  paint: PdfPaint
}

export type PatternOutline = {
  id: string
  /** Closed ring, first point not repeated at the end. */
  polygon: Point[]
  /** The authored segments behind `polygon`, in the same order. */
  segments: PdfPathSegment[]
  areaMm2: number
  perimeterMm: number
  bounds: PatternBounds
}

export type SeparatedPiece = {
  id: string
  outline: PatternOutline
  /** Outlines enclosed by this one: windows, slots, card openings. */
  cutouts: PatternOutline[]
  dots: PatternDot[]
}

export type IgnoredPath = {
  id: string
  reason: 'unpainted' | 'open-path' | 'too-small' | 'not-round'
  bounds: PatternBounds
}

export type PatternSeparation = {
  pieces: SeparatedPiece[]
  /** Dots that fell outside every piece — logo punctuation, legend keys. */
  strayDots: PatternDot[]
  ignored: IgnoredPath[]
}

function perimeter(polygon: Point[]) {
  let total = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** Drops the duplicated closing vertex a flattened subpath carries. */
function toRing(polyline: Point[]): Point[] {
  if (polyline.length < 2) return polyline
  const first = polyline[0]
  const last = polyline[polyline.length - 1]
  if (Math.hypot(last.x - first.x, last.y - first.y) <= 1e-6) {
    return polyline.slice(0, -1)
  }
  return polyline
}

function centroidOf(ring: Point[]): Point {
  const bounds = polygonBounds(ring)
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
}

/**
 * True when every vertex of `inner` lies inside `outer`.
 *
 * Sampling a few vertices would be faster, but a card slot that pokes out of
 * its piece is a real authoring error worth surfacing rather than rounding off.
 */
function isEnclosedBy(inner: Point[], outer: Point[]) {
  return inner.every((point) => pointInPolygon(point, outer))
}

type Candidate = {
  id: string
  subpath: PdfSubpath
  ring: Point[]
  paint: PdfPaint
  areaMm2: number
  perimeterMm: number
  bounds: PatternBounds
}

function candidatesFrom(paths: PdfVectorPath[]): { candidates: Candidate[]; ignored: IgnoredPath[] } {
  const candidates: Candidate[] = []
  const ignored: IgnoredPath[] = []
  for (const path of paths) {
    path.subpaths.forEach((subpath, index) => {
      const id = path.subpaths.length > 1 ? `${path.id}-${index + 1}` : path.id
      const ring = toRing(subpath.polyline)
      const bounds = polygonBounds(ring.length > 0 ? ring : [{ x: 0, y: 0 }])
      if (path.paint === 'none') {
        // Clip rectangles and the page frame. Never geometry.
        ignored.push({ id, reason: 'unpainted', bounds })
        return
      }
      if (!subpath.closed || ring.length < 3) {
        ignored.push({ id, reason: 'open-path', bounds })
        return
      }
      candidates.push({
        id,
        subpath,
        ring,
        paint: path.paint,
        areaMm2: Math.abs(polygonArea(ring)),
        perimeterMm: perimeter(ring),
        bounds,
      })
    })
  }
  return { candidates, ignored }
}

function roundness(areaMm2: number, perimeterMm: number) {
  if (perimeterMm <= 0) return 0
  return (4 * Math.PI * areaMm2) / (perimeterMm * perimeterMm)
}

/**
 * Splits `paths` into pieces, their cutouts, and the punch marks that sit on
 * them.
 *
 * Pieces come back largest first, and each piece's dots are the ones enclosed
 * by its outline. A dot inside a cutout belongs to no piece — it is over a hole
 * — so it lands in `strayDots`.
 */
export function separatePatternPaths(
  paths: PdfVectorPath[],
  options: Partial<PatternSeparationOptions> = {},
): PatternSeparation {
  const config = { ...DEFAULT_SEPARATION_OPTIONS, ...options }
  const { candidates, ignored } = candidatesFrom(paths)

  const outlines: PatternOutline[] = []
  const dots: PatternDot[] = []
  for (const candidate of candidates) {
    if (candidate.areaMm2 >= config.minPieceAreaMm2) {
      outlines.push({
        id: candidate.id,
        polygon: candidate.ring,
        segments: candidate.subpath.segments,
        areaMm2: candidate.areaMm2,
        perimeterMm: candidate.perimeterMm,
        bounds: candidate.bounds,
      })
      continue
    }
    const span = Math.max(candidate.bounds.width, candidate.bounds.height)
    if (span > config.maxDotDiameterMm) {
      ignored.push({ id: candidate.id, reason: 'too-small', bounds: candidate.bounds })
      continue
    }
    if (roundness(candidate.areaMm2, candidate.perimeterMm) < config.minDotRoundness) {
      ignored.push({ id: candidate.id, reason: 'not-round', bounds: candidate.bounds })
      continue
    }
    dots.push({
      id: candidate.id,
      center: centroidOf(candidate.ring),
      // Equivalent-area diameter: steadier than the bbox on a coarse ring.
      diameterMm: 2 * Math.sqrt(candidate.areaMm2 / Math.PI),
      paint: candidate.paint,
    })
  }

  // Largest first, so an outline is only ever tested against outlines that
  // could actually contain it.
  outlines.sort((a, b) => b.areaMm2 - a.areaMm2)
  const cutoutsFor = new Map<string, PatternOutline[]>()
  const roots: PatternOutline[] = []
  for (const outline of outlines) {
    const host = roots.find((candidate) => isEnclosedBy(outline.polygon, candidate.polygon))
    if (host) {
      const list = cutoutsFor.get(host.id) ?? []
      list.push(outline)
      cutoutsFor.set(host.id, list)
    } else {
      roots.push(outline)
    }
  }

  const pieces: SeparatedPiece[] = roots.map((outline) => ({
    id: outline.id,
    outline,
    cutouts: cutoutsFor.get(outline.id) ?? [],
    dots: [],
  }))

  const strayDots: PatternDot[] = []
  for (const dot of dots) {
    const piece = pieces.find(
      (entry) =>
        pointInPolygon(dot.center, entry.outline.polygon) &&
        !entry.cutouts.some((cutout) => pointInPolygon(dot.center, cutout.polygon)),
    )
    if (piece) piece.dots.push(dot)
    else strayDots.push(dot)
  }

  return { pieces, strayDots, ignored }
}
