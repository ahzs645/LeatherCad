import { describe, expect, it } from 'vitest'
import type { LineShape, SketchGroup } from '../cad/cad-types'
import { buildGroupAccess, isShapeLocked, protectLockedShapeUpdates, protectLockedStitchUpdates, validateGroupHierarchy } from './shape-access'

const line = (patch: Partial<LineShape> = {}): LineShape => ({ id: 'shape', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, ...patch })
const group = (id: string, patch: Partial<SketchGroup> = {}): SketchGroup => ({ id, name: id, layerId: 'layer', visible: true, locked: false, ...patch })

describe('shape protection and group inheritance', () => {
  it('protects associated hole modifications, deletion and additions without blocking other paths', () => {
    const hole = { id: 'hole', shapeId: 'shape', point: { x: 1, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 0 }
    const editable = { ...hole, id: 'other-hole', shapeId: 'editable' }
    const shapes = [line({ locked: true }), line({ id: 'editable' })]
    expect(protectLockedStitchUpdates([hole, editable], [{ ...editable, angleDeg: 30 }], shapes, [])).toEqual([hole, { ...editable, angleDeg: 30 }])
    expect(protectLockedStitchUpdates([hole], [{ ...hole, point: { x: 100, y: 100 } }, { ...hole, id: 'new' }], shapes, [])).toEqual([hole])
    const groups = [group('parent', { locked: true })]
    expect(protectLockedStitchUpdates([hole], [], [line({ groupId: 'parent' })], groups)).toEqual([hole])
    const chain = [{ ...hole, chainId: 'shared' }, { ...editable, chainId: 'shared' }]
    expect(protectLockedStitchUpdates(chain, [{ ...chain[1], sequence: 99 }], shapes, [])).toEqual(chain)
    expect(protectLockedStitchUpdates([hole], [], [line()], [], new Set(['layer']))).toEqual([hole])
    expect(protectLockedShapeUpdates([line()], [], [], new Set(['layer']))).toEqual([line()])
  })
  it('inherits visibility and locks through every ancestor without changing child settings', () => {
    const groups = [group('root', { visible: false, locked: true }), group('middle', { parentId: 'root' }), group('leaf', { parentId: 'middle' })]
    const access = buildGroupAccess(groups)
    expect(access.leaf).toEqual({ visible: false, locked: true })
    expect(isShapeLocked(line({ groupId: 'leaf' }), access)).toBe(true)
    expect(groups[2]).toMatchObject({ visible: true, locked: false })
    groups[0] = group('root')
    expect(buildGroupAccess(groups).leaf).toEqual({ visible: true, locked: false })
  })

  it('rejects cycles, missing parents, duplicate IDs and excessive nesting', () => {
    expect(() => validateGroupHierarchy([group('a', { parentId: 'b' }), group('b', { parentId: 'a' })])).toThrow(/cycle/)
    expect(() => validateGroupHierarchy([group('a', { parentId: 'missing' })])).toThrow(/Missing parent/)
    expect(() => validateGroupHierarchy([group('a'), group('a')])).toThrow(/Duplicate/)
    const deep = Array.from({ length: 33 }, (_, i) => group(String(i), { parentId: i ? String(i - 1) : undefined }))
    expect(() => validateGroupHierarchy(deep)).toThrow(/32/)
    expect(() => validateGroupHierarchy(deep.slice(0, 32))).not.toThrow()
  })

  it('fails closed for corrupted hierarchies instead of exposing hidden children', () => {
    const access = buildGroupAccess([group('a', { parentId: 'b' }), group('b', { parentId: 'a' })])
    expect(access.a).toEqual({ visible: false, locked: true })
    expect(access.b).toEqual({ visible: false, locked: true })
  })

  it('preserves locked geometry and deletion while allowing other shapes to change', () => {
    const locked = line({ locked: true })
    const other = line({ id: 'other' })
    const moved = { ...other, end: { x: 30, y: 0 } }
    const prior = [locked, other]
    expect(protectLockedShapeUpdates(prior, [moved], [])).toEqual([locked, moved])
    expect(protectLockedShapeUpdates(prior, [{ ...locked, end: { x: 99, y: 0 } }, moved], [])).toEqual([locked, moved])
    expect(prior).toEqual([locked, other])
  })

  it('permits an attribute-only unlock without applying a simultaneous geometry change', () => {
    const locked = line({ locked: true, opacity: 0.4 })
    const [unlocked] = protectLockedShapeUpdates([locked], [{ ...locked, locked: false, end: { x: 99, y: 0 } }], [])
    expect(unlocked).toEqual({ ...locked, locked: false })
    expect(unlocked.type).toBe('line')
    if (unlocked.type !== 'line') throw new Error('Expected a line after unlocking')
    expect(protectLockedShapeUpdates([unlocked], [{ ...unlocked, end: { x: 20, y: 0 } }], [])[0]).toMatchObject({ end: { x: 20, y: 0 } })
  })

  it('protects shapes locked by ancestors and allows cleanup of a removed group', () => {
    const child = line({ groupId: 'child' })
    const groups = [group('root', { locked: true }), group('child', { parentId: 'root' })]
    expect(protectLockedShapeUpdates([child], [], groups)).toEqual([child])
    const locked = { ...child, locked: true }
    expect(protectLockedShapeUpdates([locked], [{ ...locked, groupId: undefined }], [])).toEqual([{ ...locked, groupId: undefined }])
  })
})
