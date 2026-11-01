import type { Point, TextShape } from '../../cad/cad-types'
import { getCachedFont } from '../../ops/opentype-ops'
import { buildTextGlyphPlacements, textBaselineAngleDeg } from '../../ops/text-shape-ops'
import { cleanRing, clipRings, orientNestedRings, validateRing } from '../stl-polygons'
import { flattenBezier } from './manufacturing-curves'

/** Uses uploaded font outlines, including glyph counters. Never substitutes estimated boxes. */
export function manufacturingTextRings(shapes: TextShape[], fontKey: string | undefined, toleranceMm: number): Point[][] {
  if (!shapes.length) return []
  const font = fontKey ? getCachedFont(fontKey) : null
  if (!font) throw new Error('Load the exact .ttf/.otf engraving font before generating text engraving.')
  const all: Point[][] = []
  let vertexCount = 0
  let commandCount = 0
  if (shapes.reduce((count, shape) => count + Array.from(shape.text).length, 0) > 2000) throw new Error('Engrave at most 2,000 characters at a time. Export text in smaller groups.')
  for (const shape of shapes) {
    for (const char of Array.from(shape.text)) {
      const glyph = font.charToGlyph(char) as ReturnType<typeof font.charToGlyph> & { path?: { commands?: unknown[] } }
      if (glyph.name === '.notdef' && char.trim()) throw new Error(`The engraving font has no glyph for ${char}. Choose a font that includes this character.`)
      commandCount += glyph.path?.commands?.length ?? 0
      if (commandCount > 50_000) throw new Error('Text engraving exceeds the font path budget. Use less text or a simpler font.')
    }
    // Keep straight text in one shaping run, so font kerning and ligatures are retained.
    const characters = shape.transform === 'none' ? [shape.text] : Array.from(shape.text)
    const placements = buildTextGlyphPlacements(shape)
    let advance = 0
    for (let index = 0; index < characters.length; index++) {
      const char = characters[index], glyph = font.charToGlyph(char)
      if (glyph.name === '.notdef' && char.trim()) throw new Error(`The engraving font has no glyph for ${char}. Choose a font that includes this character.`)
      const width = (glyph.advanceWidth ?? 0) * shape.fontSizeMm / font.unitsPerEm
      const placement = placements[index]
      const origin = placement ? { x: placement.x, y: placement.y } : shape.start
      const angle = (placement?.rotationDeg ?? textBaselineAngleDeg(shape)) * Math.PI / 180
      const offset = placement ? -width / 2 : advance
      const transform = (point: Point): Point => ({ x: origin.x + (point.x + offset) * Math.cos(angle) - point.y * Math.sin(angle), y: origin.y + (point.x + offset) * Math.sin(angle) + point.y * Math.cos(angle) })
      const path = font.getPath(char, 0, 0, shape.fontSizeMm, shape.transform === 'none' ? { tracking: (shape.trackingMm ?? 0) * 1000 / shape.fontSizeMm } : undefined)
      let current = { x: 0, y: 0 }, ring: Point[] = []
      const glyphRings: Point[][] = []
      const finish = () => {
        if (ring.length >= 3) {
          const cleaned = cleanRing(ring.map(transform)); vertexCount += cleaned.length
          if (vertexCount > 50_000) throw new Error('Text engraving exceeds 50,000 sampled vertices. Use less text or increase curve tolerance.')
          validateRing(cleaned); glyphRings.push(cleaned)
        }
        ring = []
      }
      for (const command of path.commands) {
        if (command.type === 'M') { finish(); current = { x: command.x!, y: command.y! }; ring = [current] }
        else if (command.type === 'L') { current = { x: command.x!, y: command.y! }; ring.push(current) }
        else if (command.type === 'Q' || command.type === 'C') {
          const controls = [current, { x: command.x1!, y: command.y1! }]
          if (command.type === 'C') controls.push({ x: command.x2!, y: command.y2! })
          current = { x: command.x!, y: command.y! }
          controls.push(current); ring.push(...flattenBezier(controls, toleranceMm / 2).slice(1))
        } else if (command.type === 'Z') finish()
      }
      finish()
      all.push(...orientNestedRings(glyphRings))
      const nextGlyph = index + 1 < characters.length ? font.charToGlyph(characters[index + 1]) : null
      advance += width + (shape.trackingMm ?? 0) + (nextGlyph ? font.getKerningValue(glyph, nextGlyph) * shape.fontSizeMm / font.unitsPerEm : 0)
    }
  }
  return clipRings(all)
}
