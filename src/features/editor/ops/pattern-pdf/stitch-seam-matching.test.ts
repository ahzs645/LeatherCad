import { describe, expect, it } from 'vitest'
import type { Point } from '../../cad/cad-types'
import { detectStitchPattern, type DetectedStitchChain } from './stitch-pattern-detection'
import { matchStitchSeams, type ChainOnPiece } from './stitch-seam-matching'
import type { PatternDot } from './pattern-separation'

let counter = 0

function chainFrom(points: Point[], id: string): DetectedStitchChain {
  const dots: PatternDot[] = points.map((point) => {
    counter += 1
    return { id: `${id}-${counter}`, center: point, diameterMm: 1.13, paint: 'fill' }
  })
  const [chain] = detectStitchPattern(dots, id).chains
  return chain
}

function straight(from: Point, direction: Point, count: number, pitch = 5) {
  const length = Math.hypot(direction.x, direction.y)
  return Array.from({ length: count }, (_, index) => ({
    x: from.x + (direction.x / length) * pitch * index,
    y: from.y + (direction.y / length) * pitch * index,
  }))
}

/** An L: `down` holes going down, then `across` holes going right. */
function corner(origin: Point, down: number, across: number, pitch = 5) {
  return [
    ...straight(origin, { x: 0, y: 1 }, down, pitch),
    ...straight({ x: origin.x + pitch, y: origin.y + pitch * (down - 1) }, { x: 1, y: 0 }, across, pitch),
  ]
}

function on(pieceId: string, chain: DetectedStitchChain): ChainOnPiece {
  return { pieceId, chain }
}

describe('matchStitchSeams', () => {
  it('pairs two runs punched with the same chisel on the same passes', () => {
    const matches = matchStitchSeams([
      on('panel', chainFrom(corner({ x: 0, y: 0 }, 6, 8), 'panel-run')),
      on('pocket', chainFrom(corner({ x: 200, y: 0 }, 6, 8), 'pocket-run')),
    ])

    expect(matches).toHaveLength(1)
    expect(matches[0].holeCount).toBe(14)
    expect(matches[0].lengthDeltaMm).toBeCloseTo(0, 6)
    expect(matches[0].turnMismatchDeg).toBeCloseTo(0, 6)
    expect(matches[0].fold).toBe(false)
  })

  it('will not pair runs whose corners turn opposite ways', () => {
    const left = corner({ x: 0, y: 0 }, 6, 8)
    // Mirrored: same lengths, same hole count, and impossible to sew together.
    const mirrored = left.map((point) => ({ x: 200 - point.x, y: point.y }))

    const matches = matchStitchSeams([
      on('panel', chainFrom(left, 'panel-run')),
      on('pocket', chainFrom(mirrored, 'pocket-run')),
    ])

    expect(matches).toHaveLength(0)
  })

  it('will not pair runs of different lengths', () => {
    const matches = matchStitchSeams([
      on('panel', chainFrom(straight({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 5), 'panel-run')),
      on('pocket', chainFrom(straight({ x: 0, y: 40 }, { x: 1, y: 0 }, 10, 6), 'pocket-run')),
    ])

    expect(matches).toHaveLength(0)
  })

  it('reports which end of one run meets which end of the other', () => {
    const shape = corner({ x: 0, y: 0 }, 6, 8)
    // Rotated a half turn: the two runs meet head to tail.
    const rotated = shape.map((point) => ({ x: 300 - point.x, y: 200 - point.y }))

    const [match] = matchStitchSeams([
      on('panel', chainFrom(shape, 'panel-run')),
      on('pocket', chainFrom([...rotated].reverse(), 'pocket-run')),
    ])

    expect(match.reversed).toBe(true)
  })

  it('calls a pairing on one piece a fold rather than a seam', () => {
    const piece = 'keychain-tab'
    const matches = matchStitchSeams([
      on(piece, chainFrom(straight({ x: 0, y: 0 }, { x: 0, y: 1 }, 3, 5), 'left-run')),
      on(piece, chainFrom(straight({ x: 26, y: 0 }, { x: 0, y: 1 }, 3, 5), 'right-run')),
    ])

    expect(matches).toHaveLength(1)
    expect(matches[0].fold).toBe(true)
  })

  it('gives a run that could meet two others to the one it fits best', () => {
    const exact = corner({ x: 0, y: 0 }, 6, 8)
    const looser = corner({ x: 400, y: 0 }, 6, 8, 5.1)

    const matches = matchStitchSeams([
      on('panel', chainFrom(exact, 'panel-run')),
      on('pocket', chainFrom(corner({ x: 200, y: 0 }, 6, 8), 'pocket-run')),
      on('flap', chainFrom(looser, 'flap-run')),
    ])

    expect(matches).toHaveLength(1)
    expect([matches[0].from.pieceId, matches[0].to.pieceId].sort()).toEqual(['panel', 'pocket'])
  })
})
