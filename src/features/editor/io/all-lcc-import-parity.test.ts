import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportLccDocument, importLccDocument } from './io-lcc'

// The AllLCC corpus lives on the developer's local Google Drive. The test skips cleanly when
// the directory is absent so CI and other workstations don't fail.
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

const corpusAvailable = existsSync(allLccRoot)

describe('AllLCC source project import parity', () => {
  it('imports every .lcc project without dropping known native shape families', () => {
    if (!corpusAvailable) {
      console.log(`AllLCC corpus not found at ${allLccRoot} \u2014 skipping non-hermetic test`)
      return
    }

    const files = collectLccFiles(allLccRoot).sort()
    expect(files.length).toBeGreaterThan(20)

    const failures: string[] = []
    const rawTypeCounts = new Map<string, number>()
    // Track S_HOLE parity: exported S_HOLE count should equal original S_HOLE count.
    const sholeParity: Array<{ file: string; original: number; exported: number }> = []

    for (const file of files) {
      try {
        const raw = readFileSync(file, 'utf8')
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as { shapes?: Array<{ type?: string }> }
        const originalSholeCount = (parsed.shapes ?? []).filter((s) => s.type === 'S_HOLE').length
        for (const shape of parsed.shapes ?? []) {
          if (shape.type) {
            rawTypeCounts.set(shape.type, (rawTypeCounts.get(shape.type) ?? 0) + 1)
          }
        }

        const imported = importLccDocument(raw)
        expect(imported.summary.layerCount, file).toBeGreaterThan(0)
        expect(imported.summary.shapeCount + imported.summary.stitchHoleCount + imported.summary.foldCount, file).toBeGreaterThan(0)
        expect(imported.warnings.filter((warning) => warning.startsWith('Unknown shape type')), file).toEqual([])

        const exported = exportLccDocument(imported.doc)
        const reimported = importLccDocument(exported)
        expect(reimported.summary.layerCount, file).toBeGreaterThan(0)
        expect(reimported.summary.shapeCount + reimported.summary.stitchHoleCount + reimported.summary.foldCount, file).toBeGreaterThan(0)
        expect(reimported.warnings.filter((w) => w.startsWith('Unknown shape type')), file).toEqual([])

        // S_HOLE count must be preserved through round-trip.
        const exportedParsed = JSON.parse(exported.replace(/^\uFEFF/, '')) as { shapes?: Array<{ type?: string }> }
        const exportedSholeCount = (exportedParsed.shapes ?? []).filter((s) => s.type === 'S_HOLE').length
        if (originalSholeCount > 0) {
          sholeParity.push({ file, original: originalSholeCount, exported: exportedSholeCount })
        }
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

    // Stitch holes must survive the export round-trip intact.
    const sholeDropped = sholeParity.filter((e) => e.exported !== e.original)
    expect(sholeDropped, 'Files where S_HOLE count changed after export round-trip').toEqual([])
  })
})
