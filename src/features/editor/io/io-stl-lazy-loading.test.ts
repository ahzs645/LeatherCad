import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocFile } from '../cad/cad-types'

function drawing(): DocFile {
  const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }]
  return {
    version: 1, units: 'mm',
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main',
    lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', visible: true, style: 'solid', color: '#000000' }], activeLineTypeId: 'cut',
    objects: points.map((start, i) => ({ id: `edge-${i}`, type: 'line', start, end: points[(i + 1) % points.length], layerId: 'main', lineTypeId: 'cut' })),
    foldLines: [],
  }
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.doUnmock('./manufacturing/manufacturing-solid-finishing'))

describe('lazy solid finishing failures', () => {
  it('reports an actionable load error when a module dependency cannot load, preserving the drawing', async () => {
    vi.doMock('./manufacturing/manufacturing-solid-finishing', () => { throw new TypeError('Importing a module script failed.') })
    const { buildStlExportAsync } = await import('./io-stl')
    const doc = drawing(), before = JSON.stringify(doc)
    await expect(buildStlExportAsync(doc, { mode: 'jig', edgeFinish: 'chamfer', edgeSizeMm: 0.5 })).rejects.toThrow('The solid finishing engine could not load. Save the drawing and reload to try again.')
    expect(JSON.stringify(doc)).toBe(before)
  })

  it('keeps ordinary exports available without loading the unavailable finishing module', async () => {
    const load = vi.fn(() => { throw new TypeError('Importing a module script failed.') })
    vi.doMock('./manufacturing/manufacturing-solid-finishing', load)
    const { buildStlExportAsync } = await import('./io-stl')
    const result = await buildStlExportAsync(drawing(), { mode: 'jig', edgeFinish: 'none' })
    expect(result.watertight).toBe(true)
    expect(result.dimensionsMm.depth).toBe(5)
    expect(load).not.toHaveBeenCalled()
  })

  it('preserves geometry errors thrown after the finishing module loads', async () => {
    const geometryError = new Error('Edge finishing reaches a jig pocket or bore. Reduce edge size or increase the outside margin to preserve fit dimensions.')
    vi.doMock('./manufacturing/manufacturing-solid-finishing', () => ({ buildCombinedFinishedMesh: async () => { throw geometryError } }))
    const { buildStlExportAsync } = await import('./io-stl')
    await expect(buildStlExportAsync(drawing(), { mode: 'jig', edgeFinish: 'chamfer', edgeSizeMm: 0.5 })).rejects.toBe(geometryError)
  })
})
