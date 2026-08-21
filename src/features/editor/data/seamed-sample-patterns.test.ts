import { describe, expect, it } from 'vitest'
import { resolveSeamSpans, seamsInSewOrder } from '../assembly/seam-spans'
import { compileExplicitSeams } from '../assembly/seam-stitch-compiler'
import { buildAssemblyDiagnostics } from '../assembly/assembly-diagnostics'
import { resolvePatternPieceChains } from '../ops/pattern-piece-ops'
import { buildPieceMeshes } from '../three/piece-mesh'
import { SEAMED_PATTERN_PRESETS } from './seamed-sample-patterns'

function meshesFor(preset: (typeof SEAMED_PATTERN_PRESETS)[number]) {
  const { byShapeId } = resolvePatternPieceChains(preset.doc.objects, preset.doc.lineTypes)
  return buildPieceMeshes(preset.doc.patternPieces ?? [], byShapeId)
}

describe('seamed sample patterns', () => {
  it('ships four patterns that all declare pieces and seams', () => {
    expect(SEAMED_PATTERN_PRESETS.map((preset) => preset.id)).toEqual([
      'card-case',
      'boxed-pouch',
      'dice-cup',
      'tote-bag',
    ])

    for (const preset of SEAMED_PATTERN_PRESETS) {
      expect(preset.doc.patternPieces?.length ?? 0).toBeGreaterThan(1)
      expect(preset.doc.seamConnections?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('gives every piece a closed boundary the mesh builder can use', () => {
    for (const preset of SEAMED_PATTERN_PRESETS) {
      const meshes = meshesFor(preset)
      expect(meshes.map((mesh) => mesh.pieceId).sort()).toEqual(
        (preset.doc.patternPieces ?? []).map((piece) => piece.id).sort(),
      )
    }
  })

  it('resolves every seam span to a boundary shape that is really on the piece', () => {
    for (const preset of SEAMED_PATTERN_PRESETS) {
      const meshes = meshesFor(preset)
      const meshById = new Map(meshes.map((mesh) => [mesh.pieceId, mesh]))

      for (const seam of preset.doc.seamConnections ?? []) {
        for (const side of ['from', 'to'] as const) {
          for (const span of resolveSeamSpans(seam, side)) {
            const mesh = meshById.get(span.pieceId)
            expect(mesh, `${preset.id} ${seam.id} ${side}`).toBeDefined()
            expect(span.boundaryShapeId, `${preset.id} ${seam.id} ${side}`).toBeDefined()
            const segment = mesh?.shapeSegments.find((entry) => entry.shapeId === span.boundaryShapeId)
            expect(segment, `${preset.id} ${seam.id} ${span.boundaryShapeId}`).toBeDefined()
            // The cached index must sit inside the run the shape owns, which is
            // the invariant the reconciler restores when geometry moves.
            expect(span.edgeIndex).toBeGreaterThanOrEqual(segment?.firstEdgeIndex ?? -1)
            expect(span.edgeIndex).toBeLessThanOrEqual(segment?.lastEdgeIndex ?? -1)
          }
        }
      }
    }
  })

  it('compiles every seam into a paired stitch chain', () => {
    for (const preset of SEAMED_PATTERN_PRESETS) {
      const compiled = compileExplicitSeams({
        pieceMeshes: meshesFor(preset),
        seamConnections: preset.doc.seamConnections ?? [],
      })

      expect(compiled.pairs, preset.id).toHaveLength((preset.doc.seamConnections ?? []).length)
      for (const pair of compiled.pairs) {
        expect(pair.left.holes.length).toBe(pair.right.holes.length)
        expect(pair.left.holes.length).toBeGreaterThan(1)
      }
    }
  })

  it('raises no seam diagnostics on any shipped pattern', () => {
    for (const preset of SEAMED_PATTERN_PRESETS) {
      const diagnostics = buildAssemblyDiagnostics({
        patternPieces: preset.doc.patternPieces ?? [],
        pieceMeshes: meshesFor(preset),
        seamConnections: preset.doc.seamConnections ?? [],
        foldLines: preset.doc.foldLines,
        fallbackThicknessMm: 1.4,
        layers: preset.doc.layers,
        hardwareMarkers: [],
      })

      const errors = diagnostics.filter((entry) => entry.severity === 'error')
      expect(errors.map((entry) => entry.message), preset.id).toEqual([])
    }
  })
})

describe('the boxed pouch exercises multi-span seams', () => {
  const pouch = SEAMED_PATTERN_PRESETS.find((preset) => preset.id === 'boxed-pouch')!

  it('joins three panel sides to one gusset edge as a single seam', () => {
    const seam = (pouch.doc.seamConnections ?? []).find((entry) => entry.id.endsWith('seam-front-gusset'))!

    expect(resolveSeamSpans(seam, 'from')).toHaveLength(3)
    expect(resolveSeamSpans(seam, 'to')).toHaveLength(1)
    expect(resolveSeamSpans(seam, 'from').map((span) => span.boundaryShapeId)).toEqual([
      'pouch-front-left',
      'pouch-front-bottom',
      'pouch-front-right',
    ])
  })

  it('matches the gusset length to the three sides it wraps', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: meshesFor(pouch),
      seamConnections: pouch.doc.seamConnections ?? [],
    })
    const pair = compiled.pairs.find((entry) => entry.id.includes('seam-front-gusset'))!

    // 110 + 160 + 110 of panel against 380 of gusset.
    expect(pair.left.lengthMm).toBeCloseTo(380, 5)
    expect(pair.right.lengthMm).toBeCloseTo(380, 5)
    expect(pair.rmsErrorMm).toBeCloseTo(0, 5)
  })
})

describe('the dice cup exercises curved seams', () => {
  const cup = SEAMED_PATTERN_PRESETS.find((preset) => preset.id === 'dice-cup')!

  it('sews a straight wall edge to a boundary made of four arcs', () => {
    const seam = (cup.doc.seamConnections ?? []).find((entry) => entry.id.endsWith('seam-wall-base'))!

    expect(resolveSeamSpans(seam, 'to')).toHaveLength(4)
  })

  it('measures the base as a circumference, not as four chords', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: meshesFor(cup),
      seamConnections: cup.doc.seamConnections ?? [],
    })
    const pair = compiled.pairs.find((entry) => entry.id.includes('seam-wall-base'))!

    // 2*pi*35 = 219.9mm. Sampled arcs fall a hair inside the true circle.
    expect(pair.right.lengthMm).toBeGreaterThan(215)
    expect(pair.right.lengthMm).toBeLessThan(220)
    // The wall was cut to that circumference, so the seam closes.
    expect(pair.rmsErrorMm).toBeLessThan(5)
  })
})

describe('the tote bag carries a sewing order', () => {
  const tote = SEAMED_PATTERN_PRESETS.find((preset) => preset.id === 'tote-bag')!

  it('sews sides, then base, then handles', () => {
    const ordered = seamsInSewOrder(tote.doc.seamConnections ?? [])

    expect(ordered.map((seam) => seam.name)).toEqual([
      'Left side seam',
      'Right side seam',
      'Base to front',
      'Base to back',
      'Front handle, left tab',
      'Front handle, right tab',
      'Back handle, left tab',
      'Back handle, right tab',
    ])
    expect(ordered.every((seam, index) => seam.sequence === index + 1)).toBe(true)
  })
})
