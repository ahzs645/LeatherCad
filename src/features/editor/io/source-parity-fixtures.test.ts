import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportLccDocument, importLccDocument } from './io-lcc'

const fixtureDir = join(process.cwd(), 'docs/fixtures/source-app-parity/generator-golden')
const expectedShapeCounts: Record<string, number> = {
  'box-joint-golden.lcc': 130,
  'cap-pattern-golden.lcc': 22,
  'dice-cup-golden.lcc': 56,
  'jigsaw-golden.lcc': 140,
  'letter-stamp-golden.lcc': 10,
  'pass-case-golden.lcc': 399,
  'watch-band-golden.lcc': 39,
}

describe('source parity generator golden fixtures', () => {
  it('keeps generated .lcc fixtures importable', () => {
    const fixtureFiles = readdirSync(fixtureDir).filter((file) => file.endsWith('.lcc')).sort()

    expect(fixtureFiles).toEqual([
      'box-joint-golden.lcc',
      'cap-pattern-golden.lcc',
      'dice-cup-golden.lcc',
      'jigsaw-golden.lcc',
      'letter-stamp-golden.lcc',
      'pass-case-golden.lcc',
      'watch-band-golden.lcc',
    ])

    for (const file of fixtureFiles) {
      const result = importLccDocument(readFileSync(join(fixtureDir, file), 'utf8'))
      expect(result.warnings, file).toEqual([])
      expect(result.summary.shapeCount, file).toBe(expectedShapeCounts[file])
      expect(result.summary.layerCount, file).toBe(1)

      const reimported = importLccDocument(exportLccDocument(result.doc))
      expect(reimported.summary.shapeCount, file).toBe(result.summary.shapeCount)
      expect(reimported.summary.layerCount, file).toBe(result.summary.layerCount)
    }
  })
})
