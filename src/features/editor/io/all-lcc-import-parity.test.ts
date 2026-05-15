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
  it('imports every .lcc project without dropping known native shape families', () => {
    expect(existsSync(allLccRoot)).toBe(true)
    const files = collectLccFiles(allLccRoot).sort()
    expect(files.length).toBeGreaterThan(20)

    const failures: string[] = []
    const rawTypeCounts = new Map<string, number>()
    for (const file of files) {
      try {
        const raw = readFileSync(file, 'utf8')
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as { shapes?: Array<{ type?: string }> }
        for (const shape of parsed.shapes ?? []) {
          if (shape.type) {
            rawTypeCounts.set(shape.type, (rawTypeCounts.get(shape.type) ?? 0) + 1)
          }
        }

        const imported = importLccDocument(raw)
        expect(imported.summary.layerCount, file).toBeGreaterThan(0)
        expect(imported.summary.shapeCount + imported.summary.stitchHoleCount + imported.summary.foldCount, file).toBeGreaterThan(0)
        expect(imported.warnings.filter((warning) => warning.startsWith('Unknown shape type')), file).toEqual([])

        const reimported = importLccDocument(exportLccDocument(imported.doc))
        expect(reimported.summary.layerCount, file).toBeGreaterThan(0)
        expect(reimported.summary.shapeCount + reimported.summary.stitchHoleCount + reimported.summary.foldCount, file).toBeGreaterThan(0)
      } catch (error) {
        failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    expect(rawTypeCounts.get('ARC')).toBeGreaterThan(0)
    expect(rawTypeCounts.get('BEZIER')).toBeGreaterThan(0)
    expect(rawTypeCounts.get('DOT')).toBeGreaterThan(0)
    expect(rawTypeCounts.get('OTHER')).toBeGreaterThan(0)
    expect(rawTypeCounts.get('S_HOLE')).toBeGreaterThan(0)
    expect(failures).toEqual([])
  })
})
