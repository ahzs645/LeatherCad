import { describe, expect, it } from 'vitest'
import { assertImportTextBudget, assertImportTreeBudget, MAX_IMPORT_FILE_BYTES } from './import-budget'
import { importLcadDocument } from './io-lcad'
import { parseDocumentFile } from './parse-file-import'

describe('bounded drawing imports', () => {
  it('rejects expanded polygons before constructing excessive geometry', () => {
    const points = Array.from({ length: 200_001 }, () => ({ x: 0, y: 0 }))
    expect(() => importLcadDocument(JSON.stringify({ version: 2, shapes: [{ type: 'path', polys: [points] }] }))).toThrow('expanded geometry limit')
  })

  it('bounds file bytes, parsed nesting and aggregate embedded images', () => {
    expect(() => assertImportTextBudget('x'.repeat(MAX_IMPORT_FILE_BYTES + 1))).toThrow('50 MB')
    let nested: unknown = {}
    for (let index = 0; index < 66; index++) nested = { child: nested }
    expect(() => assertImportTreeBudget(nested)).toThrow('nesting')
    expect(() => assertImportTreeBudget({ first: `data:image/png;base64,${'A'.repeat(15 * 1024 * 1024)}`, second: `data:image/png;base64,${'A'.repeat(15 * 1024 * 1024)}` })).toThrow('embedded-image')
  })

  it('does not parse or apply a canceled document read', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(parseDocumentFile('broken', 'drawing.json', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
