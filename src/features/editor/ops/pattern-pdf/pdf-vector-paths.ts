/**
 * Turns a pdf.js operator list into flattened vector paths in millimetres.
 *
 * The tracing importer rasterises a PDF page; this reads the same page as
 * geometry. pdf.js hands painting operators out in device-independent user
 * space with the transform stack left to the caller, so this walks that stack
 * itself and bakes the CTM into every coordinate.
 *
 * Authored segments are kept alongside the flattened polyline. A rounded corner
 * is one cubic in the file and should come back out as one arc, not as the 40
 * chords the polyline needs for containment tests, so both representations are
 * carried and the consumer picks.
 */

import { OPS } from '../pdfjs'

import type { Point } from '../../cad/cad-types'

export const PT_TO_MM = 25.4 / 72

/**
 * pdf.js `DrawOPS`, which the package does not re-export.
 *
 * These are the codes packed into the `constructPath` coordinate buffer,
 * unchanged since pdf.js 5.0. An unrecognised code stops the decode rather than
 * being skipped, so if a future release renumbers them the failure is an empty
 * or truncated path — visible immediately — rather than misread coordinates.
 */
const DRAW_MOVE_TO = 0
const DRAW_LINE_TO = 1
const DRAW_CURVE_TO = 2
const DRAW_QUADRATIC_CURVE_TO = 3
const DRAW_CLOSE_PATH = 4

/** Chord-height tolerance used when flattening a curve, in millimetres. */
const FLATTEN_TOLERANCE_MM = 0.02
const MAX_FLATTEN_DEPTH = 16

export type PdfPathSegment =
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'cubic'; from: Point; c1: Point; c2: Point; to: Point }

export type PdfSubpath = {
  /** Authored segments, transformed to millimetres. */
  segments: PdfPathSegment[]
  /** The same run flattened to chords, for area and containment tests. */
  polyline: Point[]
  closed: boolean
}

export type PdfPaint = 'stroke' | 'fill' | 'fill-stroke' | 'none'

/**
 * A line of type on the sheet.
 *
 * A template names its own pieces — "MAIN BODY PANEL", "CARD SLOT PANEL" — and
 * carries the maker's print-scale warning. Dropping the text loses both the
 * best available piece names and a note the user needs on the paper.
 */
export type PdfTextItem = {
  text: string
  /** Start of the baseline, in millimetres from the page's top-left. */
  position: Point
  /** Cap height in millimetres, i.e. the font size. */
  heightMm: number
  /**
   * Baseline direction, in degrees clockwise from east in the y-down document
   * frame. Sheets routinely set a panel's label sideways to fit it on the
   * piece, and placing that block horizontally stacks its lines on top of each
   * other.
   */
  rotationDeg: number
  /** Measured advance of the string, so the run does not have to be guessed. */
  widthMm: number
}

export type PdfVectorPath = {
  id: string
  subpaths: PdfSubpath[]
  paint: PdfPaint
  strokeColor: string | null
  fillColor: string | null
}

/**
 * A path without its flattened polyline — the form worth storing.
 *
 * The polyline is derived, and derived at forty chords per rounded corner, so a
 * fixture that carries it is an order of magnitude larger than one that carries
 * the curves and re-flattens them on the way in.
 */
export type PdfVectorPathData = Omit<PdfVectorPath, 'subpaths'> & {
  subpaths: Array<Omit<PdfSubpath, 'polyline'>>
}

/** Strips the derived polylines, for storing paths. */
export function dehydrateVectorPaths(paths: PdfVectorPath[]): PdfVectorPathData[] {
  return paths.map((path) => ({
    ...path,
    subpaths: path.subpaths.map(({ segments, closed }) => ({ segments, closed })),
  }))
}

/** Rebuilds the polylines `dehydrateVectorPaths` dropped. */
export function hydrateVectorPaths(paths: PdfVectorPathData[]): PdfVectorPath[] {
  return paths.map((path) => ({
    ...path,
    subpaths: path.subpaths.flatMap((subpath) => {
      if (subpath.segments.length === 0) return []
      const builder = new SubpathBuilder(subpath.segments[0].from)
      for (const segment of subpath.segments) {
        if (segment.kind === 'line') builder.lineTo(segment.to)
        else builder.curveTo(segment.c1, segment.c2, segment.to)
      }
      const rebuilt = builder.finish(subpath.closed)
      return rebuilt ? [rebuilt] : []
    }),
  }))
}

export type PdfOperatorList = {
  fnArray: number[] | ArrayLike<number>
  argsArray: unknown[]
}

/**
 * The page box, in PDF points, as pdf.js reports it in `page.view`:
 * `[x0, y0, x1, y1]` with y running up from the bottom-left.
 */
export type PdfPageBox = readonly [number, number, number, number]

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(a: Matrix, b: Matrix): Matrix {
  // Applies `b` first, then `a` — the order pdf.js's `transform` operator uses.
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function paintForOp(op: number): PdfPaint | null {
  switch (op) {
    case OPS.stroke:
    case OPS.closeStroke:
      return 'stroke'
    case OPS.fill:
    case OPS.eoFill:
      return 'fill'
    case OPS.fillStroke:
    case OPS.eoFillStroke:
    case OPS.closeFillStroke:
    case OPS.closeEOFillStroke:
      return 'fill-stroke'
    case OPS.endPath:
      return 'none'
    default:
      return null
  }
}

/**
 * Whether subpaths left open by the author are closed before painting.
 *
 * PDF closes every open subpath implicitly before filling one (PDF 32000-1
 * 8.5.3.3), and Illustrator leans on that: it emits stitch-hole discs as `f`
 * with no `h`, so treating those as open paths loses every hole on the sheet.
 * The `close*` operators close explicitly for stroking too.
 */
function closesPath(op: number) {
  return (
    op === OPS.fill ||
    op === OPS.eoFill ||
    op === OPS.fillStroke ||
    op === OPS.eoFillStroke ||
    op === OPS.closeStroke ||
    op === OPS.closeFillStroke ||
    op === OPS.closeEOFillStroke
  )
}

function distanceToChord(point: Point, from: Point, to: Point) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-9) return Math.hypot(point.x - from.x, point.y - from.y)
  return Math.abs((point.x - from.x) * dy - (point.y - from.y) * dx) / length
}

/** Appends the flattened interior of a cubic to `out`, excluding `from`. */
function flattenCubic(
  from: Point,
  c1: Point,
  c2: Point,
  to: Point,
  out: Point[],
  depth = 0,
) {
  const flat =
    distanceToChord(c1, from, to) <= FLATTEN_TOLERANCE_MM &&
    distanceToChord(c2, from, to) <= FLATTEN_TOLERANCE_MM
  if (flat || depth >= MAX_FLATTEN_DEPTH) {
    out.push(to)
    return
  }
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const p01 = mid(from, c1)
  const p12 = mid(c1, c2)
  const p23 = mid(c2, to)
  const p012 = mid(p01, p12)
  const p123 = mid(p12, p23)
  const apex = mid(p012, p123)
  flattenCubic(from, p01, p012, apex, out, depth + 1)
  flattenCubic(apex, p123, p23, to, out, depth + 1)
}

class SubpathBuilder {
  private readonly segments: PdfPathSegment[] = []
  private readonly polyline: Point[]
  private readonly start: Point

  constructor(start: Point) {
    this.start = start
    this.polyline = [start]
  }

  /** The point a following segment starts from. */
  get cursor(): Point {
    return this.polyline[this.polyline.length - 1]
  }

  lineTo(to: Point) {
    this.segments.push({ kind: 'line', from: this.cursor, to })
    this.polyline.push(to)
  }

  curveTo(c1: Point, c2: Point, to: Point) {
    const from = this.cursor
    this.segments.push({ kind: 'cubic', from, c1, c2, to })
    flattenCubic(from, c1, c2, to, this.polyline)
  }

  finish(closed: boolean): PdfSubpath | null {
    if (this.segments.length === 0) return null
    if (closed) {
      const last = this.cursor
      if (Math.hypot(last.x - this.start.x, last.y - this.start.y) > 1e-6) {
        this.segments.push({ kind: 'line', from: last, to: this.start })
        this.polyline.push(this.start)
      }
    }
    return { segments: this.segments, polyline: this.polyline, closed }
  }
}

/**
 * Decodes one `constructPath` coordinate buffer into subpaths.
 *
 * `toMm` carries both the CTM and the point-to-millimetre flip, so the builder
 * never sees PDF user space.
 */
function decodeBuffer(
  coords: ArrayLike<number>,
  toMm: (x: number, y: number) => Point,
  subpaths: PdfSubpath[],
  forceClose: boolean,
) {
  let builder: SubpathBuilder | null = null
  let index = 0
  const flush = (closed: boolean) => {
    const done = builder?.finish(closed)
    if (done) subpaths.push(done)
    builder = null
  }
  while (index < coords.length) {
    const op = coords[index]
    switch (op) {
      case DRAW_MOVE_TO: {
        flush(forceClose)
        builder = new SubpathBuilder(toMm(coords[index + 1], coords[index + 2]))
        index += 3
        break
      }
      case DRAW_LINE_TO: {
        builder?.lineTo(toMm(coords[index + 1], coords[index + 2]))
        index += 3
        break
      }
      case DRAW_CURVE_TO: {
        builder?.curveTo(
          toMm(coords[index + 1], coords[index + 2]),
          toMm(coords[index + 3], coords[index + 4]),
          toMm(coords[index + 5], coords[index + 6]),
        )
        index += 7
        break
      }
      case DRAW_QUADRATIC_CURVE_TO: {
        // Raised to a cubic so downstream code has one curve kind to handle.
        const control = toMm(coords[index + 1], coords[index + 2])
        const to = toMm(coords[index + 3], coords[index + 4])
        const from = builder?.cursor
        if (from) {
          builder?.curveTo(
            { x: from.x + (2 / 3) * (control.x - from.x), y: from.y + (2 / 3) * (control.y - from.y) },
            { x: to.x + (2 / 3) * (control.x - to.x), y: to.y + (2 / 3) * (control.y - to.y) },
            to,
          )
        }
        index += 5
        break
      }
      case DRAW_CLOSE_PATH: {
        flush(true)
        index += 1
        break
      }
      default:
        // An unrecognised code means the buffer layout moved under us; stopping
        // beats walking off into misread coordinates.
        index = coords.length
        break
    }
  }
  flush(forceClose)
}

/**
 * Walks a pdf.js operator list and returns every painted path on the page,
 * in millimetres with y running down from the top-left of `pageBox`.
 *
 * Clip paths and other unpainted geometry come back with `paint: 'none'`.
 */
export function buildVectorPaths(
  operatorList: PdfOperatorList,
  pageBox: PdfPageBox,
): PdfVectorPath[] {
  const [boxX0, boxY0, , boxY1] = pageBox
  const stack: Matrix[] = []
  let ctm: Matrix = IDENTITY
  let strokeColor: string | null = null
  let fillColor: string | null = null
  const paths: PdfVectorPath[] = []

  const { fnArray, argsArray } = operatorList
  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i]
    const args = argsArray[i]
    switch (fn) {
      case OPS.save:
        stack.push(ctm)
        break
      case OPS.restore:
        ctm = stack.pop() ?? IDENTITY
        break
      case OPS.transform: {
        const m = args as number[]
        ctm = multiply(ctm, [m[0], m[1], m[2], m[3], m[4], m[5]])
        break
      }
      case OPS.setStrokeRGBColor:
        strokeColor = String((args as unknown[])[0])
        break
      case OPS.setFillRGBColor:
        fillColor = String((args as unknown[])[0])
        break
      case OPS.constructPath: {
        const [paintOp, buffers] = args as [number, ArrayLike<number>[]]
        const paint = paintForOp(paintOp)
        if (paint === null) break
        const toMm = (x: number, y: number): Point => {
          const px = ctm[0] * x + ctm[2] * y + ctm[4]
          const py = ctm[1] * x + ctm[3] * y + ctm[5]
          return { x: (px - boxX0) * PT_TO_MM, y: (boxY1 - boxY0 - (py - boxY0)) * PT_TO_MM }
        }
        const subpaths: PdfSubpath[] = []
        for (const buffer of buffers ?? []) {
          decodeBuffer(buffer, toMm, subpaths, closesPath(paintOp))
        }
        if (subpaths.length === 0) break
        paths.push({
          id: `pdf-path-${paths.length + 1}`,
          subpaths,
          paint,
          strokeColor: paint === 'fill' ? null : strokeColor,
          fillColor: paint === 'stroke' ? null : fillColor,
        })
        break
      }
      default:
        break
    }
  }
  return paths
}
