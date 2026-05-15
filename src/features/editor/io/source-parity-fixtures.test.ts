import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importLccDocument } from './io-lcc'

const fixtureDir = join(process.cwd(), 'docs/fixtures/source-app-parity/generator-golden')

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
      expect(result.summary.shapeCount, file).toBeGreaterThan(0)
      expect(result.summary.layerCount, file).toBe(1)
    }
  })
})
