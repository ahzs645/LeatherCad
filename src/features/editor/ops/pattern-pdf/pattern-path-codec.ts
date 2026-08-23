/**
 * A small on-disk form for extracted pattern paths.
 *
 * Reading a PDF needs pdf.js and a browser-ish environment; everything after it
 * is arithmetic. Keeping the extracted paths in a file lets the analysis be
 * developed, tested, and re-run against a real sheet without either. The
 * geometry is written as SVG path data because it is the most compact honest
 * encoding of exactly what the file holds — moves, lines, cubics, closes — and
 * because it stays readable when someone opens the fixture to see what broke.
 *
 * Flattened polylines are not stored. They are derived from the curves, at
 * around forty chords per rounded corner, and storing them makes the file an
 * order of magnitude larger for nothing.
 */

import type { Point } from '../../cad/cad-types'
import {
  hydrateVectorPaths,
  type PdfPaint,
  type PdfPathSegment,
  type PdfVectorPath,
} from './pdf-vector-paths'

export type PatternPathsFile = {
  version: 1
  /** Where the geometry came from, for whoever opens the file later. */
  source?: string
  page: { widthMm: number; heightMm: number }
  paths: Array<{
    id: string
    paint: PdfPaint
    stroke?: string
    fill?: string
    /** One SVG path data string per subpath, in millimetres. */
    d: string[]
  }>
}

/** Micrometre precision: finer than any punch, and it keeps the file small. */
const DECIMALS = 3

function num(value: number) {
  return Number(value.toFixed(DECIMALS)).toString()
}

function pair(point: Point) {
  return `${num(point.x)} ${num(point.y)}`
}

export function segmentsToPathData(segments: PdfPathSegment[], closed: boolean) {
  if (segments.length === 0) return ''
  const parts = [`M${pair(segments[0].from)}`]
  for (const segment of segments) {
    parts.push(
      segment.kind === 'line'
        ? `L${pair(segment.to)}`
        : `C${pair(segment.c1)} ${pair(segment.c2)} ${pair(segment.to)}`,
    )
  }
  if (closed) parts.push('Z')
  return parts.join('')
}

export function pathDataToSegments(data: string): { segments: PdfPathSegment[]; closed: boolean } {
  const tokens = data.match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  const segments: PdfPathSegment[] = []
  let cursor: Point = { x: 0, y: 0 }
  let start: Point = { x: 0, y: 0 }
  let closed = false
  let index = 0
  const readPoint = (): Point => {
    const point = { x: Number(tokens[index]), y: Number(tokens[index + 1]) }
    index += 2
    return point
  }
  while (index < tokens.length) {
    const command = tokens[index]
    index += 1
    switch (command.toUpperCase()) {
      case 'M':
        cursor = readPoint()
        start = cursor
        break
      case 'L': {
        const to = readPoint()
        segments.push({ kind: 'line', from: cursor, to })
        cursor = to
        break
      }
      case 'C': {
        const c1 = readPoint()
        const c2 = readPoint()
        const to = readPoint()
        segments.push({ kind: 'cubic', from: cursor, c1, c2, to })
        cursor = to
        break
      }
      case 'Z':
        closed = true
        cursor = start
        break
      default:
        // A stray number without a command means the string is not path data.
        index = tokens.length
        break
    }
  }
  return { segments, closed }
}

export function encodePatternPaths(
  paths: PdfVectorPath[],
  page: { widthMm: number; heightMm: number },
  source?: string,
): PatternPathsFile {
  return {
    version: 1,
    source,
    page: { widthMm: Number(page.widthMm.toFixed(DECIMALS)), heightMm: Number(page.heightMm.toFixed(DECIMALS)) },
    paths: paths.map((path) => ({
      id: path.id,
      paint: path.paint,
      ...(path.strokeColor ? { stroke: path.strokeColor } : {}),
      ...(path.fillColor ? { fill: path.fillColor } : {}),
      d: path.subpaths.map((subpath) => segmentsToPathData(subpath.segments, subpath.closed)),
    })),
  }
}

export function decodePatternPaths(file: PatternPathsFile): PdfVectorPath[] {
  return hydrateVectorPaths(
    file.paths.map((path) => ({
      id: path.id,
      paint: path.paint,
      strokeColor: path.stroke ?? null,
      fillColor: path.fill ?? null,
      subpaths: path.d.map((data) => pathDataToSegments(data)),
    })),
  )
}
