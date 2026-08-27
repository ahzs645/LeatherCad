/**
 * Each of these checks exists because an agent produced a document that scored
 * full marks while carrying the defect the check looks for. So each one is
 * tested the only way that means anything: against a document built to carry
 * that defect, and against the same document with the defect taken out.
 *
 * The fixtures are AI Builder JSON rather than hand-assembled `DocFile`s, so
 * they go through the same parser, compiler and geometry resolvers a benchmark
 * output does.
 */

import { describe, expect, it } from 'vitest'
import type { DocFile } from '../cad/cad-types'
import { compileAiBuilderDocument } from './ai-builder-compile'
import {
  checkFoldsReachCutEdges,
  checkMarksOnLeather,
  checkPiecesDoNotOverlap,
  checkSeamsMateCorrectly,
} from './ai-builder-functional-checks'
import { parseAiBuilderDocument } from './ai-builder-parse'

type Entity = Record<string, unknown>

function compileFixture(entities: Entity[]): DocFile {
  const parsed = parseAiBuilderDocument(
    JSON.stringify({
      schema_version: 1,
      document_name: 'fixture',
      units: 'mm',
      layers: [{ id: 'sheet', name: 'Sheet' }],
      entities,
    }),
  )
  if (!parsed.ok) {
    throw new Error(`fixture did not parse: ${JSON.stringify(parsed.errors)}`)
  }
  return compileAiBuilderDocument(parsed.document).doc
}

function rectangle(id: string, x: number, y: number, width: number, height: number): Entity {
  return { id, type: 'rectangle', layer_id: 'sheet', x, y, width, height, line_role: 'cut' }
}

function patternPiece(id: string, boundary: string, name: string, internal: string[] = []): Entity {
  return {
    id,
    type: 'pattern_piece',
    layer_id: 'sheet',
    boundary_entity_id: boundary,
    internal_entity_ids: internal,
    name,
  }
}

function stitchPath(id: string, start: [number, number], end: [number, number]): Entity {
  return {
    id,
    type: 'stitch_path',
    layer_id: 'sheet',
    path_type: 'line',
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    pitch_mm: 5,
  }
}

function fold(id: string, start: [number, number], end: [number, number]): Entity {
  return {
    id,
    type: 'fold',
    name: id,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
  }
}

/** The left edge of a rectangle, split into its two halves and sewn together. */
/**
 * One edge sewn to itself about its midpoint: a fold-over closure.
 *
 * Head-to-tail intent lives on the connection, and the app reads an absent
 * flag as reversed (`connection.reversed !== false`), so the default here is
 * the closure that works -- t = 0 meeting t = 1. Passing `false` walks both
 * halves the same way instead, which mates the corner to the fold point and
 * is the twist the check has to catch.
 *
 * A span-level `reversed` used to be a second way to say this, and setting
 * both composed into a no-op. It does not any more, so it cannot be used to
 * build a twisted fixture.
 */
function selfSeam(id: string, pieceId: string, headToTail = true): Entity {
  return {
    id,
    type: 'seam_connection',
    kind: 'sewn',
    from: { piece_id: pieceId, edge_index: 3, t0: 0, t1: 0.5 },
    to: { piece_id: pieceId, edge_index: 3, t0: 0.5, t1: 1 },
    ...(headToTail ? {} : { reversed: false }),
  }
}

describe('pieces-dont-overlap', () => {
  const laidOutApart = [
    rectangle('shell', 0, 0, 50, 50),
    rectangle('pocket', 70, 0, 50, 50),
    patternPiece('shell_piece', 'shell', 'Shell'),
    patternPiece('pocket_piece', 'pocket', 'Pocket'),
  ]

  it('stays quiet on a nesting that leaves the pieces apart', () => {
    const check = checkPiecesDoNotOverlap(compileFixture(laidOutApart))

    expect(check.points).toBe(2)
    expect(check.max).toBe(2)
    expect(check.note).toContain('worst shared area 0.00mm2')
  })

  it('fires when two pieces are cut from the same leather', () => {
    const overlapping = [...laidOutApart]
    overlapping[1] = rectangle('pocket', 25, 0, 50, 50)

    const check = checkPiecesDoNotOverlap(compileFixture(overlapping))

    expect(check.points).toBe(0)
    expect(check.max).toBe(2)
    // 25mm of the 50mm pocket sits on the 50mm-tall shell.
    expect(check.note).toContain('1250.00mm2')
    expect(check.note).toContain('"Shell"')
    expect(check.note).toContain('"Pocket"')
  })

  it('is not scored at all when there is only one piece to place', () => {
    const check = checkPiecesDoNotOverlap(
      compileFixture([rectangle('shell', 0, 0, 50, 50), patternPiece('shell_piece', 'shell', 'Shell')]),
    )

    expect(check.max).toBe(0)
  })
})

describe('marks-on-leather', () => {
  it('stays quiet when the stitch run is on the piece that owns it', () => {
    const check = checkMarksOnLeather(
      compileFixture([
        rectangle('panel', 0, 0, 60, 80),
        stitchPath('side_stitch', [5, 5], [5, 75]),
        patternPiece('panel_piece', 'panel', 'Panel', ['side_stitch']),
      ]),
    )

    expect(check.points).toBe(2)
    expect(check.max).toBe(2)
    expect(check.note).toContain('on the leather they belong to')
  })

  it('fires when the whole stitch run has moved off the leather', () => {
    const check = checkMarksOnLeather(
      compileFixture([
        rectangle('panel', 0, 0, 60, 80),
        stitchPath('side_stitch', [100, 5], [100, 75]),
        patternPiece('panel_piece', 'panel', 'Panel', ['side_stitch']),
      ]),
    )

    expect(check.points).toBe(0)
    expect(check.note).toContain('stitch hole')
    expect(check.note).toContain('40.00mm out')
  })

  it('fires on a label stamped beside the piece it names', () => {
    const check = checkMarksOnLeather(
      compileFixture([
        rectangle('panel', 0, 0, 60, 80),
        stitchPath('side_stitch', [5, 5], [5, 75]),
        { id: 'panel_label', type: 'text', layer_id: 'sheet', position: { x: 10, y: -12 }, value: 'Panel', line_role: 'mark' },
        patternPiece('panel_piece', 'panel', 'Panel', ['side_stitch', 'panel_label']),
      ]),
    )

    expect(check.points).toBe(0)
    expect(check.note).toContain('1 label')
    expect(check.note).toContain('12.00mm out')
  })

  it('leaves a hardware marker alone when it sits inside its layer’s piece', () => {
    const check = checkMarksOnLeather(
      compileFixture([
        rectangle('panel', 0, 0, 60, 80),
        { id: 'snap', type: 'hardware_marker', layer_id: 'sheet', point: { x: 30, y: 40 }, kind: 'snap', label: 'Snap' },
        patternPiece('panel_piece', 'panel', 'Panel'),
      ]),
    )

    expect(check.points).toBe(2)
  })
})

describe('folds-reach-cut-edges', () => {
  it('stays quiet on a crease that runs cut edge to cut edge', () => {
    const check = checkFoldsReachCutEdges(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        fold('centre_fold', [0, 30], [100, 30]),
        patternPiece('body_piece', 'body', 'Body'),
      ]),
    )

    expect(check.points).toBe(2)
    expect(check.max).toBe(2)
    expect(check.note).toContain('reach both cut edges')
  })

  it('fires on a crease that stops short of both cut edges', () => {
    const check = checkFoldsReachCutEdges(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        fold('centre_fold', [25, 30], [75, 30]),
        patternPiece('body_piece', 'body', 'Body'),
      ]),
    )

    expect(check.points).toBe(0)
    expect(check.max).toBe(2)
    expect(check.note).toContain('stop short')
    expect(check.note).toContain('25.00mm')
  })

  it('is not scored when no fold divides a piece', () => {
    const check = checkFoldsReachCutEdges(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        fold('elsewhere', [0, 400], [100, 400]),
        patternPiece('body_piece', 'body', 'Body'),
      ]),
    )

    expect(check.max).toBe(0)
  })
})

describe('seams-mate-correctly', () => {
  it('stays quiet when a fold-over seam mates about one crease', () => {
    const check = checkSeamsMateCorrectly(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        patternPiece('body_piece', 'body', 'Body'),
        selfSeam('side_seam', 'body_piece'),
      ]),
    )

    expect(check.points).toBe(2)
    expect(check.max).toBe(2)
    expect(check.note).toContain('worst crease deviation 0.00mm')
  })

  it('fires when a fold-over seam is sewn head-to-head instead of head-to-tail', () => {
    const check = checkSeamsMateCorrectly(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        patternPiece('body_piece', 'body', 'Body'),
        selfSeam('side_seam', 'body_piece', false),
      ]),
    )

    expect(check.points).toBe(0)
    expect(check.max).toBe(2)
    expect(check.note).toContain('joins "Body" to itself')
    // Each half of the 60mm edge is 30mm, and the twist walks the whole of it.
    expect(check.note).toContain('30.00mm')
  })

  it('fires when the seam graph never reaches a piece', () => {
    const check = checkSeamsMateCorrectly(
      compileFixture([
        rectangle('body', 0, 0, 100, 60),
        rectangle('patch', 150, 0, 20, 20),
        patternPiece('body_piece', 'body', 'Body'),
        patternPiece('patch_piece', 'patch', 'Patch'),
        selfSeam('side_seam', 'body_piece'),
      ]),
    )

    expect(check.points).toBe(0)
    expect(check.note).toContain('"Patch" is not reached by any seam')
  })

  it('is not scored when nothing is sewn', () => {
    const check = checkSeamsMateCorrectly(
      compileFixture([rectangle('body', 0, 0, 100, 60), patternPiece('body_piece', 'body', 'Body')]),
    )

    expect(check.max).toBe(0)
  })
})
