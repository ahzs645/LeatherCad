import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileAiBuilderDocument } from '../ai-builder/ai-builder-compile'
import type { AiBuilderDocumentV1 } from '../ai-builder/ai-builder-types'
import { createDefaultLineTypes, CUT_LINE_TYPE_ID } from '../cad/line-types'
import type { DocFile } from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  getWebMcpActivitySnapshot,
  resetWebMcpActivityForTests,
} from './webmcp-activity'
import type { ExportFormat, WebMcpBridge } from './webmcp-bridge-types'
import { mergeCompiledDocument } from './webmcp-merge'
import { buildWebMcpTools, WEBMCP_TOOL_NAMES } from './webmcp-tools'
import type { WebMcpToolDescriptor } from './webmcp-api'

function emptyDoc(): DocFile {
  const lineTypes = createDefaultLineTypes()
  return {
    version: 1,
    units: 'mm',
    documentName: 'Untitled',
    layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, stackLevel: 0 }],
    activeLayerId: 'layer-1',
    lineTypes,
    activeLineTypeId: CUT_LINE_TYPE_ID,
    objects: [],
    foldLines: [],
    stitchHoles: [],
    patternPieces: [],
    seamAllowances: [],
    seamConnections: [],
    hardwareMarkers: [],
  }
}

/**
 * The editor, reduced to the parts a tool can touch. It runs the same compile
 * and merge the live bridge runs, so these tests exercise the real path from a
 * tool call to resolved geometry — only the React state is stubbed out.
 */
function createHarness() {
  let doc = emptyDoc()
  const exported: ExportFormat[] = []
  const undo = vi.fn()

  const bridge: WebMcpBridge = {
    getDocument: () => doc,
    applyDocument: (document, label) => {
      const compiled = compileAiBuilderDocument(document)
      const merged = mergeCompiledDocument(
        {
          layers: doc.layers,
          shapes: doc.objects,
          foldLines: doc.foldLines,
          stitchHoles: doc.stitchHoles ?? [],
          patternPieces: doc.patternPieces ?? [],
          seamAllowances: (doc.seamAllowances ?? []) as never,
          seamConnections: doc.seamConnections ?? [],
          hardwareMarkers: doc.hardwareMarkers ?? [],
        },
        compiled.doc,
      )
      const beforeHoles = (doc.stitchHoles ?? []).length
      doc = {
        ...doc,
        layers: merged.layers,
        objects: merged.shapes,
        foldLines: merged.foldLines,
        stitchHoles: normalizeStitchHoleSequences(merged.stitchHoles),
        patternPieces: merged.patternPieces,
        seamAllowances: merged.seamAllowances,
        seamConnections: merged.seamConnections,
        hardwareMarkers: merged.hardwareMarkers,
      }
      return {
        ok: true,
        message: label,
        preflight: compiled.preflight,
        insertedPieceIds: merged.insertedPieceIds,
        insertedShapeCount: merged.insertedShapeIds.length,
        insertedStitchHoleCount: merged.stitchHoles.length - beforeHoles,
      }
    },
    replaceDocument: (document, label) => {
      const compiled = compileAiBuilderDocument(document)
      doc = { ...compiled.doc, documentName: document.document_name }
      return {
        ok: true,
        message: label,
        preflight: compiled.preflight,
        insertedPieceIds: (doc.patternPieces ?? []).map((piece) => piece.id),
        insertedShapeCount: doc.objects.length,
        insertedStitchHoleCount: (doc.stitchHoles ?? []).length,
      }
    },
    clearDocument: () => {
      doc = emptyDoc()
    },
    renameDocument: (name) => {
      doc = { ...doc, documentName: name }
    },
    selectPieces: (pieceIds) => pieceIds.length,
    undo,
    exportDocument: (format) => {
      exported.push(format)
      return { ok: true, message: `Started a ${format} download.` }
    },
    setStatus: () => {},
  }

  const tools = new Map(buildWebMcpTools(bridge).map((tool) => [tool.name, tool]))

  async function call(name: string, input: Record<string, unknown> = {}) {
    const tool = tools.get(name) as WebMcpToolDescriptor
    expect(tool, `tool ${name} is not registered`).toBeDefined()
    const result = await tool.execute(input)
    const text = result.content.map((part) => part.text).join('\n')
    return {
      isError: result.isError === true,
      text,
      json: () => JSON.parse(text) as Record<string, never>,
    }
  }

  return { call, exported, undo, getDoc: () => doc, tools }
}

beforeEach(() => {
  resetWebMcpActivityForTests()
})

describe('buildWebMcpTools', () => {
  it('publishes exactly the tools the UI advertises', () => {
    const { tools } = createHarness()
    expect([...tools.keys()]).toEqual([...WEBMCP_TOOL_NAMES])
  })

  it('gives every tool a description and an object input schema', () => {
    const { tools } = createHarness()
    for (const tool of tools.values()) {
      expect(tool.description.length).toBeGreaterThan(40)
      expect(tool.inputSchema.type).toBe('object')
      expect(typeof tool.execute).toBe('function')
    }
  })
})

describe('create_pattern_piece', () => {
  it('turns dimensions into a piece the app can measure', async () => {
    const harness = createHarness()
    const result = await harness.call('create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Wallet body',
      width_mm: 190,
      height_mm: 95,
      corner_radius_mm: 8,
      quantity: 1,
      stitch_inset_mm: 4,
      stitch_pitch_mm: 3.85,
    })

    expect(result.isError).toBe(false)
    const payload = result.json() as unknown as {
      ok: boolean
      measured: { widthMm: number; heightMm: number; stitchHoleCount: number }
    }
    expect(payload.ok).toBe(true)
    expect(payload.measured.widthMm).toBeCloseTo(190, 0)
    expect(payload.measured.heightMm).toBeCloseTo(95, 0)
    expect(payload.measured.stitchHoleCount).toBeGreaterThan(100)
  })

  it('places an unplaced piece clear of the work already on the sheet', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'First', width_mm: 100, height_mm: 60 })
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Second', width_mm: 80, height_mm: 40 })

    const listed = (await harness.call('list_pattern_pieces')).json() as unknown as {
      pieces: Array<{ name: string; boundsMm: { minX: number; maxX: number } }>
    }
    const [first, second] = listed.pieces
    expect(second.boundsMm.minX).toBeGreaterThan(first.boundsMm.maxX)
  })

  it('honours an explicit position', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', {
      shape: 'circle',
      name: 'Disc',
      width_mm: 40,
      center_x_mm: 250,
      center_y_mm: -80,
    })
    const listed = (await harness.call('list_pattern_pieces')).json() as unknown as {
      pieces: Array<{ centerMm: { x: number; y: number } }>
    }
    expect(listed.pieces[0].centerMm.x).toBeCloseTo(250, 0)
    expect(listed.pieces[0].centerMm.y).toBeCloseTo(-80, 0)
  })

  it('reports rather than silently skips a stitch line that will not fit', async () => {
    const harness = createHarness()
    const result = await harness.call('create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Tiny tab',
      width_mm: 8,
      height_mm: 8,
      stitch_inset_mm: 6,
    })
    const payload = result.json() as unknown as { warnings: string[] }
    expect(payload.warnings.join(' ')).toContain('stitch line')
  })

  it('answers a missing dimension instead of throwing', async () => {
    const harness = createHarness()
    const result = await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'No size' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('width_mm')
  })

  it('rejects a shape it does not know', async () => {
    const harness = createHarness()
    const result = await harness.call('create_pattern_piece', { shape: 'hexagon', name: 'Odd', width_mm: 50, height_mm: 50 })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('rounded_rect')
  })
})

describe('check_pattern', () => {
  it('passes a pattern built through the tools', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Body',
      width_mm: 190,
      height_mm: 95,
      corner_radius_mm: 8,
      stitch_inset_mm: 4,
    })
    await harness.call('create_pattern_piece', {
      shape: 'card_slot',
      name: 'Card slot',
      width_mm: 92,
      height_mm: 60,
      scoop_mm: 14,
    })

    const report = (await harness.call('check_pattern')).json() as unknown as {
      score: { points: number; max: number; passing: boolean }
      checks: Array<{ name: string; passed: boolean; note: string }>
    }
    expect(report.checks.length).toBeGreaterThan(0)
    expect(report.score.passing).toBe(true)
  })

  it('catches two pieces stacked on the same leather', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', {
      shape: 'rounded_rect', name: 'A', width_mm: 100, height_mm: 60, center_x_mm: 0, center_y_mm: 0,
    })
    await harness.call('create_pattern_piece', {
      shape: 'rounded_rect', name: 'B', width_mm: 100, height_mm: 60, center_x_mm: 10, center_y_mm: 10,
    })

    const report = (await harness.call('check_pattern')).json() as unknown as {
      score: { passing: boolean }
      checks: Array<{ name: string; passed: boolean }>
    }
    expect(report.score.passing).toBe(false)
  })
})

describe('estimate_material', () => {
  it('turns the pattern into hides, waste and thread', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Body',
      width_mm: 190,
      height_mm: 95,
      quantity: 2,
      stitch_inset_mm: 4,
    })

    const estimate = (await harness.call('estimate_material', {
      hide_area_sqft: 24,
      price_per_hide: 180,
    })).json() as unknown as {
      totalCutPieces: number
      hidesRequired: number
      estimatedCost: number
      thread: { threadLengthM: number }
    }

    expect(estimate.totalCutPieces).toBe(2)
    expect(estimate.hidesRequired).toBe(1)
    expect(estimate.estimatedCost).toBe(180)
    expect(estimate.thread.threadLengthM).toBeGreaterThan(1)
  })

  it('works from panel dimensions when there is no hide', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Body', width_mm: 100, height_mm: 100 })
    const estimate = (await harness.call('estimate_material', {
      hide_width_mm: 300,
      hide_length_mm: 300,
      nesting_efficiency: 1,
    })).json() as unknown as { hidesRequired: number }
    expect(estimate.hidesRequired).toBe(1)
  })
})

describe('add_stitch_line', () => {
  it('punches a run at the pitch it was given', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', {
      shape: 'rounded_rect', name: 'Panel', width_mm: 100, height_mm: 60, center_x_mm: 0, center_y_mm: 0,
    })
    const before = (harness.getDoc().stitchHoles ?? []).length

    const result = await harness.call('add_stitch_line', {
      name: 'Base seam',
      start: { x: -40, y: 20 },
      end: { x: 40, y: 20 },
      pitch_mm: 4,
    })

    expect(result.isError).toBe(false)
    const after = (harness.getDoc().stitchHoles ?? []).length
    // 80mm at a 4mm pitch is 21 holes counting both ends.
    expect(after - before).toBe(21)
  })

  it('answers a malformed point instead of throwing', async () => {
    const harness = createHarness()
    const result = await harness.call('add_stitch_line', { name: 'Bad', start: { x: 0 }, end: { x: 10, y: 0 } })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('start')
  })
})

describe('apply_pattern_json', () => {
  const sleeve: AiBuilderDocumentV1 = {
    schema_version: 1,
    document_name: 'Card sleeve',
    units: 'mm',
    layers: [{ id: 'body', name: 'Body' }],
    entities: [
      { id: 'outline', type: 'rectangle', layer_id: 'body', x: -45, y: -32, width: 90, height: 64, line_role: 'cut' },
      { id: 'piece', type: 'pattern_piece', layer_id: 'body', boundary_entity_id: 'outline', name: 'Sleeve', quantity: 2 },
    ],
  }

  it('merges into the open document by default', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Existing', width_mm: 60, height_mm: 40 })
    await harness.call('apply_pattern_json', { document: sleeve })

    const names = (harness.getDoc().patternPieces ?? []).map((piece) => piece.name)
    expect(names).toContain('Existing')
    expect(names).toContain('Sleeve')
  })

  it('replaces the document only when asked to', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Existing', width_mm: 60, height_mm: 40 })
    await harness.call('apply_pattern_json', { document: sleeve, mode: 'replace' })

    const names = (harness.getDoc().patternPieces ?? []).map((piece) => piece.name)
    expect(names).toEqual(['Sleeve'])
  })

  it('accepts the document as a JSON string too', async () => {
    const harness = createHarness()
    const result = await harness.call('apply_pattern_json', { document: JSON.stringify(sleeve) })
    expect(result.isError).toBe(false)
  })

  it('hands back validation errors the model can act on', async () => {
    const harness = createHarness()
    const result = await harness.call('apply_pattern_json', {
      document: { schema_version: 1, document_name: 'Broken', units: 'mm', layers: [], entities: [{ id: 'x' }] },
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('describe_pattern_format')
  })
})

describe('the rest of the surface', () => {
  it('reports which pieces a highlight matched and which it did not', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Card slot', width_mm: 92, height_mm: 60 })
    const result = (await harness.call('select_pattern_pieces', {
      piece_names: ['card', 'gusset'],
    })).json() as unknown as { matchedPieces: string[]; unmatched: string[] }

    expect(result.matchedPieces).toEqual(['Card slot'])
    expect(result.unmatched).toEqual(['gusset'])
  })

  it('empties the document when the person asks to start over', async () => {
    const harness = createHarness()
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'Panel', width_mm: 60, height_mm: 40 })
    expect(harness.getDoc().patternPieces).toHaveLength(1)

    const result = await harness.call('clear_document')
    expect(result.isError).toBe(false)
    expect(result.text).toContain('1 piece')
    expect(harness.getDoc().patternPieces).toHaveLength(0)
    expect(harness.getDoc().objects).toHaveLength(0)
  })

  it('renames the document', async () => {
    const harness = createHarness()
    await harness.call('rename_document', { name: 'Bifold v3' })
    expect(harness.getDoc().documentName).toBe('Bifold v3')
  })

  it('undoes through the editor history', async () => {
    const harness = createHarness()
    await harness.call('undo_last_change')
    expect(harness.undo).toHaveBeenCalledTimes(1)
  })

  it('exports in the format asked for and refuses one it does not have', async () => {
    const harness = createHarness()
    await harness.call('export_pattern', { format: 'dxf' })
    expect(harness.exported).toEqual(['dxf'])

    const bad = await harness.call('export_pattern', { format: 'gcode' })
    expect(bad.isError).toBe(true)
  })

  it('describes the document format it accepts', async () => {
    const harness = createHarness()
    const described = (await harness.call('describe_pattern_format')).json() as unknown as {
      entity_types: Record<string, string>
      rules: string[]
    }
    expect(Object.keys(described.entity_types)).toContain('pattern_piece')
    expect(described.rules.length).toBeGreaterThan(2)
  })

  it('summarises an empty document without pretending it has pieces', async () => {
    const harness = createHarness()
    const overview = (await harness.call('get_pattern_overview')).json() as unknown as {
      patternPieceCount: number
      totalCutAreaMm2: number
    }
    expect(overview.patternPieceCount).toBe(0)
    expect(overview.totalCutAreaMm2).toBe(0)
  })
})

describe('activity logging', () => {
  it('records every call, successful or not, for the person watching', async () => {
    const harness = createHarness()
    await harness.call('get_pattern_overview')
    await harness.call('create_pattern_piece', { shape: 'rounded_rect', name: 'No size' })

    const entries = getWebMcpActivitySnapshot()
    expect(entries).toHaveLength(2)
    expect(entries[0].toolName).toBe('create_pattern_piece')
    expect(entries[0].status).toBe('error')
    expect(entries[1].status).toBe('ok')
  })
})
