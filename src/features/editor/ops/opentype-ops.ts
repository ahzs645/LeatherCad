/**
 * OpenType.js integration for text-to-path conversion and real font metrics.
 *
 * Provides:
 *  - Loading .ttf/.otf font files
 *  - Converting text shapes to vector path outlines (LineShape/BezierShape)
 *  - Actual glyph metrics (width, kerning) to replace estimateTextWidthMm
 */

import * as opentype from 'opentype.js'
import { uid } from '../cad/cad-geometry'
import type { Point, Shape, TextShape, BezierShape } from '../cad/cad-types'

// ---------------------------------------------------------------------------
// Font cache
// ---------------------------------------------------------------------------

const fontCache = new Map<string, opentype.Font>()

/**
 * Loads a font from a URL and caches it.
 */
export async function loadFont(url: string): Promise<opentype.Font> {
  const cached = fontCache.get(url)
  if (cached) return cached

  const font = await opentype.load(url)
  fontCache.set(url, font)
  return font
}

/**
 * Loads a font from an ArrayBuffer (e.g., from file input).
 */
export function loadFontFromBuffer(buffer: ArrayBuffer, cacheKey: string): opentype.Font {
  const font = opentype.parse(buffer)
  fontCache.set(cacheKey, font)
  return font
}

/**
 * Gets a cached font by key, or null if not loaded.
 */
export function getCachedFont(key: string): opentype.Font | null {
  return fontCache.get(key) ?? null
}

// ---------------------------------------------------------------------------
// Text metrics
// ---------------------------------------------------------------------------

/**
 * Measures the width of text in mm using actual font metrics.
 *
 * Falls back to estimation if no font is loaded.
 */
export function measureTextWidthMm(
  text: string,
  fontSizeMm: number,
  fontUrl?: string,
): number {
  if (!fontUrl) {
    // Fallback estimation
    return Math.max(fontSizeMm * 0.8, text.length * fontSizeMm * 0.62)
  }

  const font = fontCache.get(fontUrl)
  if (!font) {
    return Math.max(fontSizeMm * 0.8, text.length * fontSizeMm * 0.62)
  }

  const unitsPerEm = font.unitsPerEm
  const scale = fontSizeMm / unitsPerEm

  let totalWidth = 0
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i])
    totalWidth += (glyph.advanceWidth ?? 0) * scale

    // Kerning
    if (i < text.length - 1) {
      const kerning = font.getKerningValue(
        font.charToGlyph(text[i]),
        font.charToGlyph(text[i + 1]),
      )
      totalWidth += kerning * scale
    }
  }

  return totalWidth
}

// ---------------------------------------------------------------------------
// Text to path conversion
// ---------------------------------------------------------------------------

type PathCommand = {
  type: 'M' | 'L' | 'Q' | 'C' | 'Z'
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

/**
 * Converts an opentype.js path to our internal command format.
 */
function parseOpentypePath(path: opentype.Path): PathCommand[] {
  const commands: PathCommand[] = []
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        commands.push({ type: 'M', x: cmd.x, y: cmd.y })
        break
      case 'L':
        commands.push({ type: 'L', x: cmd.x, y: cmd.y })
        break
      case 'Q':
        commands.push({ type: 'Q', x: cmd.x, y: cmd.y, x1: cmd.x1, y1: cmd.y1 })
        break
      case 'C':
        commands.push({
          type: 'C',
          x: cmd.x,
          y: cmd.y,
          x1: cmd.x1,
          y1: cmd.y1,
          x2: cmd.x2,
          y2: cmd.y2,
        })
        break
      case 'Z':
        commands.push({ type: 'Z' })
        break
    }
  }
  return commands
}

/**
 * Converts path commands to LeatherCad shapes (lines and quadratic beziers).
 *
 * Cubic beziers are approximated with two quadratic beziers.
 */
function commandsToShapes(
  commands: PathCommand[],
  layerId: string,
  lineTypeId: string,
  groupId: string | undefined,
  offsetX: number,
  offsetY: number,
  scale: number,
): Shape[] {
  const shapes: Shape[] = []
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0

  function toPoint(x: number, y: number): Point {
    return {
      x: offsetX + x * scale,
      // Flip Y axis (font coordinates are Y-up, canvas is Y-down)
      y: offsetY - y * scale,
    }
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        currentX = cmd.x!
        currentY = cmd.y!
        startX = currentX
        startY = currentY
        break

      case 'L': {
        const start = toPoint(currentX, currentY)
        const end = toPoint(cmd.x!, cmd.y!)
        if (Math.hypot(end.x - start.x, end.y - start.y) > 0.01) {
          shapes.push({
            id: uid(),
            type: 'line',
            layerId,
            lineTypeId,
            groupId,
            start,
            end,
          })
        }
        currentX = cmd.x!
        currentY = cmd.y!
        break
      }

      case 'Q': {
        const start = toPoint(currentX, currentY)
        const control = toPoint(cmd.x1!, cmd.y1!)
        const end = toPoint(cmd.x!, cmd.y!)
        shapes.push({
          id: uid(),
          type: 'bezier',
          layerId,
          lineTypeId,
          groupId,
          start,
          control,
          end,
        } as BezierShape)
        currentX = cmd.x!
        currentY = cmd.y!
        break
      }

      case 'C': {
        // Approximate cubic bezier with two quadratic beziers
        const p0 = { x: currentX, y: currentY }
        const p1 = { x: cmd.x1!, y: cmd.y1! }
        const p2 = { x: cmd.x2!, y: cmd.y2! }
        const p3 = { x: cmd.x!, y: cmd.y! }

        // Split cubic at t=0.5
        const mid01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
        const mid12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        const mid23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 }
        const mid012 = { x: (mid01.x + mid12.x) / 2, y: (mid01.y + mid12.y) / 2 }
        const mid123 = { x: (mid12.x + mid23.x) / 2, y: (mid12.y + mid23.y) / 2 }
        const midPt = { x: (mid012.x + mid123.x) / 2, y: (mid012.y + mid123.y) / 2 }

        // First half: p0 -> mid012 (control) -> midPt
        shapes.push({
          id: uid(),
          type: 'bezier',
          layerId,
          lineTypeId,
          groupId,
          start: toPoint(p0.x, p0.y),
          control: toPoint(mid012.x, mid012.y),
          end: toPoint(midPt.x, midPt.y),
        } as BezierShape)

        // Second half: midPt -> mid123 (control) -> p3
        shapes.push({
          id: uid(),
          type: 'bezier',
          layerId,
          lineTypeId,
          groupId,
          start: toPoint(midPt.x, midPt.y),
          control: toPoint(mid123.x, mid123.y),
          end: toPoint(p3.x, p3.y),
        } as BezierShape)

        currentX = cmd.x!
        currentY = cmd.y!
        break
      }

      case 'Z': {
        if (Math.hypot(currentX - startX, currentY - startY) > 0.01) {
          const start = toPoint(currentX, currentY)
          const end = toPoint(startX, startY)
          shapes.push({
            id: uid(),
            type: 'line',
            layerId,
            lineTypeId,
            groupId,
            start,
            end,
          })
        }
        currentX = startX
        currentY = startY
        break
      }
    }
  }

  return shapes
}

/**
 * Converts a TextShape to vector path outlines using opentype.js.
 *
 * Returns the shapes representing the glyph outlines, or null if the
 * font isn't loaded.
 */
export function textToPathShapes(
  textShape: TextShape,
  fontUrl: string | null,
): { ok: boolean; shapes: Shape[]; message: string } {
  if (!fontUrl) {
    return { ok: false, shapes: [], message: 'No font URL specified' }
  }

  const font = fontCache.get(fontUrl)
  if (!font) {
    return { ok: false, shapes: [], message: 'Font not loaded. Load the font file first.' }
  }

  const text = textShape.text.trim() || 'Text'
  const fontSizeMm = Math.max(2, Math.min(120, textShape.fontSizeMm || 12))
  const unitsPerEm = font.unitsPerEm
  const scale = fontSizeMm / unitsPerEm

  // Get the full text path
  const path = font.getPath(text, 0, 0, unitsPerEm)
  const commands = parseOpentypePath(path)

  const shapes = commandsToShapes(
    commands,
    textShape.layerId,
    textShape.lineTypeId,
    textShape.groupId,
    textShape.start.x,
    textShape.start.y,
    scale,
  )

  if (shapes.length === 0) {
    return { ok: false, shapes: [], message: 'No path data generated from text' }
  }

  return {
    ok: true,
    shapes,
    message: `Converted "${text}" to ${shapes.length} path shapes`,
  }
}

/**
 * Gets individual glyph advance widths and kerning for accurate placement.
 */
export function getGlyphMetrics(
  text: string,
  fontUrl: string,
  fontSizeMm: number,
): { widths: number[]; kernings: number[]; totalWidth: number } | null {
  const font = fontCache.get(fontUrl)
  if (!font) return null

  const scale = fontSizeMm / font.unitsPerEm
  const widths: number[] = []
  const kernings: number[] = []
  let totalWidth = 0

  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i])
    const width = (glyph.advanceWidth ?? 0) * scale
    widths.push(width)
    totalWidth += width

    if (i < text.length - 1) {
      const kerning = font.getKerningValue(
        glyph,
        font.charToGlyph(text[i + 1]),
      ) * scale
      kernings.push(kerning)
      totalWidth += kerning
    } else {
      kernings.push(0)
    }
  }

  return { widths, kernings, totalWidth }
}
