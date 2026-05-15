import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportLccDocument, importLccDocument } from './io-lcc'

const allLccRoot = '/Users/ahmadjalil/Library/CloudStorage/GoogleDrive-ahzs645@gmail.com/My Drive/Projects/Leather/AllLCC'

function collectLccFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectLccFiles(path)
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.lcc') ? [path] : []
  })
}

describe('AllLCC source project import parity', () => {
  it('imports every .lcc project and reimports LeatherCad export output', () => {
    expect(existsSync(allLccRoot)).toBe(true)
    const files = collectLccFiles(allLccRoot).sort()
    expect(files.length).toBeGreaterThan(20)

    const failures: string[] = []
    for (const file of files) {
      try {
        const imported = importLccDocument(readFileSync(file, 'utf8'))
        expect(imported.summary.layerCount, file).toBeGreaterThan(0)
        expect(imported.summary.shapeCount + imported.summary.stitchHoleCount + imported.summary.foldCount, file).toBeGreaterThan(0)

        const reimported = importLccDocument(exportLccDocument(imported.doc))
        expect(reimported.summary.layerCount, file).toBeGreaterThan(0)
      } catch (error) {
        failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    expect(failures).toEqual([])
  })
})
