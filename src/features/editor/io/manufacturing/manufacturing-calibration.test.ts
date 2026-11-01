import { describe, expect, it } from 'vitest'
import { buildPrinterFitCalibration } from './manufacturing-calibration'
import type { Point } from '../../cad/cad-types'

describe('printer fit calibration fixture', () => {
  it('provides measured geometry for the labelled holes, pocket clearances and raised bar', () => {
    const fixture = buildPrinterFitCalibration(), { mesh } = fixture
    const slice = (z: number): Point[] => mesh.triangles.flatMap(tri => {
      const intersections: Point[] = []
      for (let i = 0; i < 3; i++) {
        const a = mesh.vertices[tri[i]], b = mesh.vertices[tri[(i + 1) % 3]]
        if ((a.z < z && b.z > z) || (b.z < z && a.z > z)) { const t = (z - a.z) / (b.z - a.z); intersections.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) }
      }
      return intersections
    })
    const extent = (points: Point[], axis: 'x' | 'y') => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]))
    for (const pocket of fixture.manifest.pockets) {
      const points = slice(3).filter(p => Math.abs(p.x - pocket.xMm) < 5 && Math.abs(p.y - 30) < 6)
      expect(extent(points, 'x')).toBeCloseTo(pocket.widthMm, 4)
      expect(extent(points, 'y')).toBeCloseTo(pocket.lengthMm, 4)
      expect(slice(1).filter(p => Math.abs(p.x - pocket.xMm) < 5 && Math.abs(p.y - 30) < 6)).toHaveLength(0)
    }
    for (const hole of fixture.manifest.holes) {
      const points = slice(1).filter(p => Math.abs(p.x - hole.xMm) < 3 && Math.abs(p.y - hole.yFromNotchedEdgeMm) < 3)
      expect(extent(points, 'x')).toBeCloseTo(hole.diameterMm, 2)
      expect(extent(points, 'y')).toBeCloseTo(hole.diameterMm, 2)
    }
    const bar = slice(5.5).filter(p => p.x >= 5 && p.x <= 25 && p.y <= 6)
    expect(extent(bar, 'x')).toBe(20); expect(extent(bar, 'y')).toBe(3)
    expect(fixture.volumeMm3).toBeGreaterThan(19_000)
    expect(fixture.manifest.physicalChecks).toBe('unperformed')
    expect(fixture.checklist).toContain('have NOT been performed')
    expect(fixture.content).not.toMatch(/NaN|Infinity/)
  })
})
