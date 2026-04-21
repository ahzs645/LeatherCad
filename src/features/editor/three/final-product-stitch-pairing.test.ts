import { describe, expect, it } from 'vitest'
import type { StitchHole } from '../cad/cad-types'
import { buildStitchChains, pairStitchChains } from './final-product-stitch-pairing'

function chain(id: string, points: Array<{ x: number; y: number }>): StitchHole[] {
  return points.map((point, index) => ({
    id: `${id}-${index}`,
    shapeId: `${id}-shape-${index}`,
    chainId: id,
    point,
    angleDeg: 0,
    holeType: 'round',
    sequence: index,
  }))
}

function row(id: string, count: number, x: number, y: number, pitch = 3, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => ({
    x: x + index * pitch,
    y,
  }))
  return chain(id, reverse ? points.reverse() : points)
}

describe('final product stitch pairing', () => {
  it('pairs YubiKey-like 7/7, 4/4, 4/4, 7/7 stitch chains with reversed directions', () => {
    const holes = [
      ...row('a7', 7, 0, 0),
      ...row('b7', 7, 0, 8, 3, true),
      ...row('c4', 4, 0, 24),
      ...row('d4', 4, 0, 32, 3, true),
      ...row('e4', 4, 30, 24),
      ...row('f4', 4, 30, 32, 3, true),
      ...row('g7', 7, 0, 48),
      ...row('h7', 7, 0, 56, 3, true),
    ]

    const { chains } = buildStitchChains(holes)
    const { pairs, diagnostics } = pairStitchChains(chains)

    expect(pairs).toHaveLength(4)
    expect(pairs.every((pair) => pair.reversed)).toBe(true)
    expect(pairs.map((pair) => pair.left.pointCount).sort((left, right) => left - right)).toEqual([4, 4, 7, 7])
    expect(diagnostics.filter((diagnostic) => diagnostic.code === 'stitch-chain-unpaired')).toHaveLength(0)
  })

  it('leaves ambiguous same-count chains unpaired with diagnostics', () => {
    const holes = [
      ...row('a', 4, 0, 0),
      ...row('b', 4, 0, 10, 3, true),
      ...row('c', 4, 0, 20),
    ]

    const { chains } = buildStitchChains(holes)
    const { pairs, diagnostics } = pairStitchChains(chains)

    expect(pairs).toHaveLength(0)
    expect(diagnostics.some((diagnostic) => diagnostic.code === 'stitch-pair-ambiguous')).toBe(true)
    expect(diagnostics.filter((diagnostic) => diagnostic.code === 'stitch-chain-unpaired')).toHaveLength(3)
  })
})
