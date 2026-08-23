import { describe, expect, it } from 'vitest'
import { parseFoldLine } from './editor-parsers'

const base = {
  id: 'fold-1',
  name: 'Wallet spine',
  start: { x: 0, y: 10 },
  end: { x: 100, y: 10 },
  angleDeg: 45,
  maxAngleDeg: 180,
  direction: 'mountain',
}

describe('parseFoldLine', () => {
  it('keeps the piece a crease belongs to', () => {
    // Dropped, this costs the fold its attribution on every save and reload,
    // and the 3D view is left to guess from geometry which piece a crease
    // bends — a guess that has no right answer for a crease drawn where two
    // pieces overlap.
    expect(parseFoldLine({ ...base, pieceId: 'piece-a' })?.pieceId).toBe('piece-a')
  })

  it('keeps the interface a crease was authored from', () => {
    expect(parseFoldLine({ ...base, interfaceId: 'interface-3' })?.interfaceId).toBe('interface-3')
  })

  it('keeps the fold allowance, bend radius and hinge lock', () => {
    const parsed = parseFoldLine({ ...base, foldAllowanceMm: 2.5, bendRadiusMm: 3, lockedHinge: true })
    expect(parsed?.foldAllowanceMm).toBe(2.5)
    expect(parsed?.bendRadiusMm).toBe(3)
    expect(parsed?.lockedHinge).toBe(true)
  })

  it('leaves an unattributed crease unattributed', () => {
    const parsed = parseFoldLine(base)
    expect(parsed?.pieceId).toBeUndefined()
    expect(parsed?.interfaceId).toBeUndefined()
  })

  it('rejects an empty piece id rather than storing one nothing matches', () => {
    expect(parseFoldLine({ ...base, pieceId: '' })?.pieceId).toBeUndefined()
  })
})
