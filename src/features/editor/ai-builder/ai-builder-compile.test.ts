import { describe, expect, it } from 'vitest'
import { GUIDE_LINE_TYPE_ID, MARK_LINE_TYPE_ID, STITCH_LINE_TYPE_ID } from '../cad/line-types'
import { AI_BUILDER_EXAMPLES } from './ai-builder-examples'
import { compileAiBuilderDocument } from './ai-builder-compile'
import { parseAiBuilderDocument } from './ai-builder-parse'
import type { AiBuilderDocumentV1 } from './ai-builder-types'

describe('compileAiBuilderDocument', () => {
  it('expands rectangles into deterministic edge shapes', () => {
    const document: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'rect_panel',
      units: 'mm',
      layers: [{ id: 'panel', name: 'Panel' }],
      entities: [
        {
          id: 'panel_outline',
          type: 'rectangle',
          layer_id: 'panel',
          x: 10,
          y: 20,
          width: 30,
          height: 40,
        },
      ],
    }

    const result = compileAiBuilderDocument(document)

    expect(result.summary.shapeCount).toBe(4)
    expect(result.doc.objects.map((shape) => shape.id)).toEqual([
      'rect__panel_outline__top',
      'rect__panel_outline__right',
      'rect__panel_outline__bottom',
      'rect__panel_outline__left',
    ])
  })

  it('applies text defaults and mark line-role fallback', () => {
    const document: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'text_defaults',
      units: 'mm',
      layers: [{ id: 'markings', name: 'Markings' }],
      entities: [
        {
          id: 'brand_mark',
          type: 'text',
          layer_id: 'markings',
          position: { x: 5, y: 10 },
          value: 'Heritage',
        },
      ],
    }

    const result = compileAiBuilderDocument(document)
    const textShape = result.doc.objects[0]

    expect(textShape.type).toBe('text')
    expect(textShape.lineTypeId).toBe(MARK_LINE_TYPE_ID)
    if (textShape.type !== 'text') {
      return
    }
    expect(textShape.fontSizeMm).toBe(14)
    expect(textShape.fontFamily).toBe('Georgia, serif')
    expect(textShape.end.x).toBeGreaterThan(textShape.start.x)
  })

  it('compiles folds and maps explicit line roles', () => {
    const document: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'fold_and_guide',
      units: 'mm',
      layers: [{ id: 'panel', name: 'Panel' }],
      entities: [
        {
          id: 'guide_path',
          type: 'line',
          layer_id: 'panel',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 100 },
          line_role: 'guide',
        },
        {
          id: 'center_fold',
          type: 'fold',
          start: { x: 10, y: 0 },
          end: { x: 10, y: 100 },
        },
      ],
    }

    const result = compileAiBuilderDocument(document)

    expect(result.summary.shapeCount).toBe(1)
    expect(result.summary.foldCount).toBe(1)
    expect(result.doc.objects[0]?.lineTypeId).toBe(GUIDE_LINE_TYPE_ID)
    expect(result.doc.foldLines[0]?.id).toBe('fold__center_fold')
    expect(result.doc.foldLines[0]?.name).toBe('Center Fold')
  })

  it('compiles stitch paths to stitch geometry and generated holes', () => {
    const document: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'stitched_panel',
      units: 'mm',
      layers: [{ id: 'panel', name: 'Panel' }],
      entities: [
        {
          id: 'bottom_stitching',
          type: 'stitch_path',
          layer_id: 'panel',
          path_type: 'line',
          start: { x: 0, y: 80 },
          end: { x: 20, y: 80 },
          pitch_mm: 5,
          hole_type: 'slit',
          render_shape: 'diamond',
          width_mm: 1.2,
          height_mm: 0.55,
          tilt_deg: 35,
        },
      ],
    }

    const result = compileAiBuilderDocument(document)

    expect(result.summary.shapeCount).toBe(1)
    expect(result.summary.stitchHoleCount).toBe(5)
    expect(result.doc.objects[0]).toMatchObject({
      id: 'stitch__bottom_stitching',
      type: 'line',
      lineTypeId: STITCH_LINE_TYPE_ID,
    })
    expect(result.doc.stitchHoles).toHaveLength(5)
    expect(result.doc.stitchHoles?.[0]).toMatchObject({
      id: 'stitch_hole__bottom_stitching__1',
      shapeId: 'stitch__bottom_stitching',
      holeType: 'slit',
      renderShape: 'diamond',
      widthMm: 1.2,
      heightMm: 0.55,
      tiltDeg: 35,
      sequence: 0,
    })
  })

  it('compiles leather-native metadata, refs, and preflight', () => {
    const document: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'rich_panel',
      units: 'mm',
      layers: [{ id: 'shell', name: 'Shell' }],
      entities: [
        {
          id: 'shell_outline',
          type: 'rectangle',
          layer_id: 'shell',
          x: -50,
          y: -30,
          width: 100,
          height: 60,
        },
        {
          id: 'shell_piece',
          type: 'pattern_piece',
          layer_id: 'shell',
          boundary_entity_id: 'shell_outline',
          name: 'Shell',
          quantity: 2,
          material_side: 'grain',
        },
        {
          id: 'shell_allowance',
          type: 'seam_allowance',
          piece_id: 'shell_piece',
          default_offset_mm: 3,
        },
        {
          id: 'shell_snap',
          type: 'hardware_marker',
          layer_id: 'shell',
          point: { x: 0, y: 0 },
          kind: 'snap',
          hole_diameter_mm: 4,
        },
        {
          id: 'shell_self_seam',
          type: 'seam_connection',
          from: { piece_id: 'shell_piece', edge_index: 0 },
          to: { piece_id: 'shell_piece', edge_index: 2, reversed: true },
          kind: 'aligned',
          tolerance_mm: 2,
        },
      ],
    }

    const result = compileAiBuilderDocument(document)

    expect(result.summary.patternPieceCount).toBe(1)
    expect(result.summary.seamAllowanceCount).toBe(1)
    expect(result.summary.seamConnectionCount).toBe(1)
    expect(result.summary.hardwareMarkerCount).toBe(1)
    expect(result.summary.preflightErrorCount).toBe(0)
    expect(result.doc.patternPieces?.[0]).toMatchObject({
      id: 'piece__shell_piece',
      boundaryShapeId: 'rect__shell_outline__top',
      quantity: 2,
      materialSide: 'grain',
    })
    expect(result.doc.seamAllowances?.[0]).toMatchObject({
      id: 'seam_allowance__shell_allowance',
      pieceId: 'piece__shell_piece',
      defaultOffsetMm: 3,
    })
    expect(result.doc.hardwareMarkers?.[0]).toMatchObject({
      id: 'hardware__shell_snap',
      kind: 'snap',
      holeDiameterMm: 4,
    })
    expect(result.refs.some((entry) => entry.ref === '@leather[pattern_piece:piece__shell_piece]')).toBe(true)
  })

  it('parses and compiles every curated example', () => {
    AI_BUILDER_EXAMPLES.forEach((example) => {
      const parsed = parseAiBuilderDocument(JSON.stringify(example))
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        return
      }

      const compiled = compileAiBuilderDocument(parsed.document)
      expect(compiled.summary.layerCount).toBeGreaterThan(0)
      expect(compiled.summary.entityCount).toBe(parsed.document.entities.length)
      expect(compiled.summary.shapeCount + compiled.summary.foldCount).toBeGreaterThan(0)
      expect(compiled.summary.stitchHoleCount).toBe(compiled.doc.stitchHoles?.length ?? 0)
      expect(compiled.summary.preflightErrorCount).toBeGreaterThanOrEqual(0)
    })
  })
})
