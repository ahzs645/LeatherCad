import { describe, expect, it } from 'vitest'
import { planLcadStitchChains, type LcadHoleRecord } from './lcad-stitch-chains'

const hole = (id: string, x: number, y: number, runId?: string, seq?: number): LcadHoleRecord => ({ id, layerId: 'main', point: { x, y }, runId, seq })

describe('planLcadStitchChains', () => {
  it('keeps runs whose sequence steps from neighbour to neighbour', () => {
    const holes = [0, 1, 2, 3].map(index => hole(`h${index}`, index * 4, 0, 'run', index))
    const { chains, regrouped } = planLcadStitchChains(holes)
    expect(regrouped).toBe(false)
    expect(holes.map(entry => chains.get(entry.id))).toEqual([0, 1, 2, 3].map(sequence => ({ chainId: 'run', sequence })))
  })

  it('regroups a mirrored run that alternates between two rows into one chain per row', () => {
    // Even seq on the left row, odd seq on the right row, 100 mm apart.
    const holes = Array.from({ length: 10 }, (_, seq) => hole(`h${seq}`, seq % 2 === 0 ? 0 : 100, Math.floor(seq / 2) * 4, 'mirrored', seq))
    const { chains, regrouped } = planLcadStitchChains(holes)
    expect(regrouped).toBe(true)
    const left = holes.filter(entry => entry.point.x === 0).map(entry => chains.get(entry.id))
    const right = holes.filter(entry => entry.point.x === 100).map(entry => chains.get(entry.id))
    expect(new Set(left.map(chain => chain?.chainId)).size).toBe(1)
    expect(new Set(right.map(chain => chain?.chainId)).size).toBe(1)
    expect(left[0]?.chainId).not.toBe(right[0]?.chainId)
    expect(left.map(chain => chain?.sequence)).toEqual([0, 1, 2, 3, 4])
    expect(right.map(chain => chain?.sequence)).toEqual([0, 1, 2, 3, 4])
  })

  it('chains holes without a run along their row, turning corners, and leaves isolated holes alone', () => {
    const row = [hole('a', 0, 0), hole('b', 4, 0), hole('c', 8, 0), hole('d', 8, 4), hole('e', 8, 8)]
    const isolated = hole('far', 200, 200)
    const { chains } = planLcadStitchChains([row[2], row[0], isolated, row[4], row[1], row[3]])
    const sequences = row.map(entry => chains.get(entry.id)?.sequence)
    expect(new Set(row.map(entry => chains.get(entry.id)?.chainId)).size).toBe(1)
    expect([sequences, [...sequences].reverse()]).toContainEqual([0, 1, 2, 3, 4])
    expect(chains.get('far')).toEqual({ chainId: undefined, sequence: 0 })
  })
})
