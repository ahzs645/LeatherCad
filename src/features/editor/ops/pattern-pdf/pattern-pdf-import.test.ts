import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describePatternImport } from './pattern-pdf-import'
import { analyzePatternPaths } from './pattern-pdf-analysis'
import { decodePatternPaths, type PatternPathsFile } from './pattern-path-codec'

const fixture = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../docs/fixtures/pattern-pdf/makesupply-keychain-snap-wallet.paths.json',
    ),
    'utf8',
  ),
) as PatternPathsFile

describe('describePatternImport', () => {
  it('says what came off the sheet in the terms a maker would check', () => {
    const analysis = analyzePatternPaths(decodePatternPaths(fixture), fixture.page)

    expect(describePatternImport(analysis, 1)).toBe(
      '3 pieces · 96 stitch holes at 4.97 mm (5.1 SPI) · 1 seam · 1 folded piece · 1 warning',
    )
  })

  it('leaves out what a sheet does not have', () => {
    const bare = analyzePatternPaths([], { widthMm: 210, heightMm: 297 })

    expect(describePatternImport(bare, 0)).toBe('0 pieces')
  })
})
