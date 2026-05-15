import { describe, expect, it } from 'vitest'
import type { LineType, Shape, StitchHoleDefaults } from '../cad/cad-types'
import {
  clearTerminalStitchHole,
  createPrickingIronStitchHoles,
  findNearestStitchAnchor,
  generateFixedPitchStitchHoles,
  getTerminalStitchHoleIdForShape,
  normalizeStitchHoleSequences,
  parseStitchHole,
  setTerminalStitchHole,
} from './stitch-hole-ops'

const lineTypesById: Record<string, LineType> = {
  cut: {
    id: 'cut',
    name: 'Cut',
    role: 'cut',
    style: 'solid',
    color: '#000000',
    visible: true,
  },
  stitch: {
    id: 'stitch',
    name: 'Stitch',
    role: 'stitch',
    style: 'solid',
    color: '#00ff00',
    visible: true,
  },
}

function lineShape(id: string, lineTypeId: string, y: number): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId,
    start: { x: 0, y },
    end: { x: 100, y },
  }
}

const stitchDefaults: StitchHoleDefaults = {
  holeType: 'round',
  diameterMm: 1.2,
}

describe('findNearestStitchAnchor', () => {
  it('places a multi-blade pricking iron group from one manual anchor', () => {
    const shape = lineShape('line-1', 'stitch', 0)
    const holes = createPrickingIronStitchHoles(
      shape,
      { shapeId: shape.id, point: { x: 2, y: 0 }, angleDeg: 0 },
      { holeType: 'slit', pitchMm: 4, numBlades: 3, widthMm: 0, heightMm: 3 },
      5,
    )

    expect(holes.map((hole) => hole.sequence)).toEqual([5, 6, 7])
    expect(holes.map((hole) => hole.point.x)).toEqual([2, 6, 10])
    expect(holes.every((hole) => hole.widthMm === 0)).toBe(true)
  })

  it('places inverted multi-blade pricking holes backward from the manual anchor', () => {
    const shape = lineShape('line-1', 'stitch', 0)
    const holes = createPrickingIronStitchHoles(
      shape,
      { shapeId: shape.id, point: { x: 12, y: 0 }, angleDeg: 0 },
      { holeType: 'slit', pitchMm: 4, numBlades: 3, widthMm: 0, heightMm: 3, inverted: true },
      0,
    )

    expect(holes.map((hole) => hole.point.x)).toEqual([12, 8, 4])
    expect(holes.map((hole) => hole.angleDeg)).toEqual([180, 180, 180])
    expect(holes.every((hole) => hole.inverted)).toBe(true)
  })

  it('preserves stitch chain ids from saved documents', () => {
    const parsed = parseStitchHole({
      id: 'hole-1',
      shapeId: 'shape-1',
      chainId: 'chain-a',
      point: { x: 2, y: 4 },
      angleDeg: 90,
      holeType: 'round',
      sequence: 2,
    })

    expect(parsed?.chainId).toBe('chain-a')
    expect(parsed?.sequence).toBe(2)
  })

  it('falls back to non-stitch geometry when enabled', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 2 },
      [lineShape('cut-line', 'cut', 0)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('cut-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(0)
  })

  it('still prefers stitch geometry over other nearby shapes', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 1.5 },
      [lineShape('cut-line', 'cut', 0), lineShape('stitch-line', 'stitch', 2)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('stitch-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(2)
  })
})

describe('generateFixedPitchStitchHoles', () => {
  it('can force fit the last hole to the path end', () => {
    const line = lineShape('stitch-line', 'stitch', 0)

    const strict = generateFixedPitchStitchHoles(line, 30, stitchDefaults)
    const forceFit = generateFixedPitchStitchHoles(line, 30, stitchDefaults, 0, {
      forceFitLastHole: true,
    })

    expect(strict).toHaveLength(5)
    expect(strict.at(-1)?.point.x).toBe(100)
    expect(forceFit).toHaveLength(4)
    expect(forceFit.at(-1)?.point.x).toBe(100)
    expect(forceFit[1]?.point.x).toBeCloseTo(100 / 3, 3)
  })

  it('supports continuation from a selected point without duplicating the start hole', () => {
    const line = lineShape('stitch-line', 'stitch', 0)

    const continued = generateFixedPitchStitchHoles(line, 20, stitchDefaults, 2, {
      forceFitLastHole: true,
      startDistanceMm: 40,
      includeStartHole: false,
    })

    expect(continued.map((hole) => hole.sequence)).toEqual([2, 3, 4])
    expect(continued.map((hole) => hole.point.x)).toEqual([60, 80, 100])
  })

  it('can stop fixed-pitch auto placement at an explicit section end boundary', () => {
    const line = lineShape('stitch-line', 'stitch', 0)

    const section = generateFixedPitchStitchHoles(line, 25, stitchDefaults, 0, {
      startDistanceMm: 20,
      endDistanceMm: 70,
      includeStartHole: false,
      forceFitLastHole: true,
    })

    expect(section.map((hole) => hole.point.x)).toEqual([45, 70])
  })
})

describe('terminal stitch markers', () => {
  it('keeps only one terminal hole per shape when marking a new end hole', () => {
    const holes = [
      { id: 'h1', shapeId: 'shape-1', point: { x: 0, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 0, endHole: true },
      { id: 'h2', shapeId: 'shape-1', point: { x: 10, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 1 },
      { id: 'h3', shapeId: 'shape-2', point: { x: 20, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 0, endHole: true },
    ]

    const updated = setTerminalStitchHole(holes, 'h2')

    expect(updated.find((hole) => hole.id === 'h1')?.endHole).toBe(false)
    expect(updated.find((hole) => hole.id === 'h2')?.endHole).toBe(true)
    expect(updated.find((hole) => hole.id === 'h3')?.endHole).toBe(true)
    expect(getTerminalStitchHoleIdForShape(updated, 'shape-1')).toBe('h2')
  })

  it('clears the terminal hole on the selected path', () => {
    const holes = [
      { id: 'h1', shapeId: 'shape-1', point: { x: 0, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 0 },
      { id: 'h2', shapeId: 'shape-1', point: { x: 10, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 1, endHole: true },
    ]

    const updated = clearTerminalStitchHole(holes, 'h2')

    expect(updated.every((hole) => hole.endHole !== true)).toBe(true)
    expect(getTerminalStitchHoleIdForShape(updated, 'shape-1')).toBeNull()
  })

  it('normalizes duplicate terminal markers during sequence normalization', () => {
    const holes = [
      { id: 'h2', shapeId: 'shape-1', point: { x: 10, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 2, endHole: true },
      { id: 'h1', shapeId: 'shape-1', point: { x: 0, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 1, endHole: true },
    ]

    const normalized = normalizeStitchHoleSequences(holes)

    expect(normalized.map((hole) => hole.sequence)).toEqual([0, 1])
    expect(normalized.filter((hole) => hole.endHole === true)).toHaveLength(1)
    expect(normalized.find((hole) => hole.endHole === true)?.id).toBe('h1')
  })

  it('normalizes imported LCC stitch holes by chain id across marker shapes', () => {
    const holes = [
      { id: 'h2', shapeId: 'shape-2', chainId: 'chain-1', point: { x: 10, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 1 },
      { id: 'h1', shapeId: 'shape-1', chainId: 'chain-1', point: { x: 0, y: 0 }, angleDeg: 90, holeType: 'round', sequence: 0 },
    ]

    const normalized = normalizeStitchHoleSequences(holes)

    expect(normalized.find((hole) => hole.id === 'h1')?.sequence).toBe(0)
    expect(normalized.find((hole) => hole.id === 'h2')?.sequence).toBe(1)
  })
})
