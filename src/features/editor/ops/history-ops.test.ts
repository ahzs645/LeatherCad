import { describe, it, expect } from 'vitest'
import { deepClone, pushHistorySnapshot, applyUndo, applyRedo } from './history-ops'
import type { HistoryState } from './history-ops'

function emptyHistory<T>(): HistoryState<T> {
  return { past: [], future: [] }
}

describe('deepClone', () => {
  it('creates an independent copy of an object', () => {
    const original = { a: 1, b: { c: 2 } }
    const cloned = deepClone(original)
    expect(cloned).toEqual(original)
    cloned.b.c = 99
    expect(original.b.c).toBe(2)
  })

  it('clones arrays', () => {
    const original = [1, 2, { x: 3 }]
    const cloned = deepClone(original)
    expect(cloned).toEqual(original)
    ;(cloned[2] as { x: number }).x = 99
    expect((original[2] as { x: number }).x).toBe(3)
  })

  it('clones primitive values', () => {
    expect(deepClone(42)).toBe(42)
    expect(deepClone('hello')).toBe('hello')
    expect(deepClone(null)).toBe(null)
  })
})

describe('pushHistorySnapshot', () => {
  it('adds snapshot to past and clears future', () => {
    const history: HistoryState<string> = {
      past: ['a'],
      future: ['c'],
    }
    const result = pushHistorySnapshot(history, 'b')
    expect(result.past).toEqual(['a', 'b'])
    expect(result.future).toEqual([])
  })

  it('caps at maxPast entries', () => {
    const history: HistoryState<number> = {
      past: Array.from({ length: 5 }, (_, i) => i),
      future: [],
    }
    const result = pushHistorySnapshot(history, 999, 3)
    expect(result.past.length).toBe(3)
    expect(result.past[result.past.length - 1]).toBe(999)
  })

  it('uses default maxPast of 120', () => {
    const history: HistoryState<number> = {
      past: Array.from({ length: 120 }, (_, i) => i),
      future: [],
    }
    const result = pushHistorySnapshot(history, 999)
    expect(result.past.length).toBe(120)
    expect(result.past[result.past.length - 1]).toBe(999)
  })

  it('deep clones the snapshot being pushed', () => {
    const history = emptyHistory<{ val: number }>()
    const obj = { val: 1 }
    const result = pushHistorySnapshot(history, obj)
    obj.val = 999
    expect(result.past[0].val).toBe(1)
  })
})

describe('applyUndo', () => {
  it('returns null snapshot when past is empty', () => {
    const history = emptyHistory<string>()
    const result = applyUndo(history, 'current')
    expect(result.snapshot).toBeNull()
    expect(result.history).toBe(history)
  })

  it('returns previous snapshot and moves current to future', () => {
    const history: HistoryState<string> = {
      past: ['a', 'b'],
      future: [],
    }
    const result = applyUndo(history, 'c')
    expect(result.snapshot).toBe('b')
    expect(result.history.past).toEqual(['a'])
    expect(result.history.future).toEqual(['c'])
  })

  it('prepends current to existing future', () => {
    const history: HistoryState<string> = {
      past: ['a'],
      future: ['c'],
    }
    const result = applyUndo(history, 'b')
    expect(result.snapshot).toBe('a')
    expect(result.history.past).toEqual([])
    expect(result.history.future).toEqual(['b', 'c'])
  })
})

describe('applyRedo', () => {
  it('returns null snapshot when future is empty', () => {
    const history = emptyHistory<string>()
    const result = applyRedo(history, 'current')
    expect(result.snapshot).toBeNull()
    expect(result.history).toBe(history)
  })

  it('returns next snapshot and moves current to past', () => {
    const history: HistoryState<string> = {
      past: [],
      future: ['b', 'c'],
    }
    const result = applyRedo(history, 'a')
    expect(result.snapshot).toBe('b')
    expect(result.history.past).toEqual(['a'])
    expect(result.history.future).toEqual(['c'])
  })

  it('appends current to existing past', () => {
    const history: HistoryState<string> = {
      past: ['a'],
      future: ['c'],
    }
    const result = applyRedo(history, 'b')
    expect(result.snapshot).toBe('c')
    expect(result.history.past).toEqual(['a', 'b'])
    expect(result.history.future).toEqual([])
  })
})
