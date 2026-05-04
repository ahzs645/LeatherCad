import { describe, expect, it } from 'vitest'
import { parseAiBuilderDocument } from './ai-builder-parse'

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2)
}

describe('parseAiBuilderDocument', () => {
  it('parses a valid minimal document', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'simple_panel',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'panel_outline',
            type: 'rectangle',
            layer_id: 'panel',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
          },
        ],
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.document.layers).toHaveLength(1)
    expect(result.document.entities).toHaveLength(1)
  })

  it('rejects duplicate IDs across layers and entities', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'duplicate_ids',
        units: 'mm',
        layers: [{ id: 'shared_id', name: 'Panel' }],
        entities: [
          {
            id: 'shared_id',
            type: 'line',
            layer_id: 'shared_id',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].id' && error.message.includes('unique'))).toBe(true)
  })

  it('rejects unknown keys', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'unknown_keys',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel', color: 'cyan' }],
        entities: [
          {
            id: 'panel_outline',
            type: 'rectangle',
            layer_id: 'panel',
            x: 0,
            y: 0,
            width: 100,
            height: 40,
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'layers[0].color')).toBe(true)
  })

  it('rejects invalid enums and missing layer references', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'bad_enums',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'guide_line',
            type: 'line',
            layer_id: 'missing_layer',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
            line_role: 'laser',
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].layer_id')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].line_role')).toBe(true)
  })

  it('rejects bad point values and rectangle dimensions', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'bad_geometry',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'bad_line',
            type: 'line',
            layer_id: 'panel',
            start: { x: 'left', y: 0 },
            end: { x: 10, y: 10 },
          },
          {
            id: 'bad_rectangle',
            type: 'rectangle',
            layer_id: 'panel',
            x: 0,
            y: 0,
            width: 0,
            height: -10,
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].start.x')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[1].width')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[1].height')).toBe(true)
  })

  it('rejects bad fold payloads', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'bad_fold',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'center_fold',
            type: 'fold',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 100 },
            direction: 'sideways',
            angle_deg: 200,
            max_angle_deg: 90,
            stiffness: 2,
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].direction')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].angle_deg')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].stiffness')).toBe(true)
  })

  it('parses stitch paths with punch settings', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'stitched_card_sleeve',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'bottom_stitches',
            type: 'stitch_path',
            layer_id: 'panel',
            path_type: 'line',
            start: { x: 0, y: 70 },
            end: { x: 120, y: 70 },
            pitch_mm: 4,
            hole_type: 'slit',
            render_shape: 'diamond',
            width_mm: 1.2,
            height_mm: 0.55,
            tilt_deg: 35,
            include_start_hole: false,
            force_fit_last_hole: true,
          },
        ],
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.document.entities[0]).toMatchObject({
      id: 'bottom_stitches',
      type: 'stitch_path',
      pitch_mm: 4,
      hole_type: 'slit',
      render_shape: 'diamond',
    })
  })

  it('rejects invalid stitch path payloads', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'bad_stitches',
        units: 'mm',
        layers: [{ id: 'panel', name: 'Panel' }],
        entities: [
          {
            id: 'bad_stitches',
            type: 'stitch_path',
            layer_id: 'panel',
            path_type: 'arc',
            start: { x: 0, y: 70 },
            end: { x: 120, y: 70 },
            pitch_mm: 0,
            hole_type: 'triangle',
            render_shape: 'star',
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].mid')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].pitch_mm')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].hole_type')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[0].render_shape')).toBe(true)
  })

  it('parses leather-native piece, seam, allowance, and hardware entities', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'rich_wallet_panel',
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
            material_side: 'grain',
            orientation: 'horizontal',
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
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.document.entities.map((entity) => entity.type)).toContain('pattern_piece')
    expect(result.document.entities.map((entity) => entity.type)).toContain('seam_allowance')
    expect(result.document.entities.map((entity) => entity.type)).toContain('seam_connection')
    expect(result.document.entities.map((entity) => entity.type)).toContain('hardware_marker')
  })

  it('rejects leather-native entities with missing cross references', () => {
    const result = parseAiBuilderDocument(
      stringify({
        schema_version: 1,
        document_name: 'bad_refs',
        units: 'mm',
        layers: [{ id: 'shell', name: 'Shell' }],
        entities: [
          {
            id: 'shell_piece',
            type: 'pattern_piece',
            layer_id: 'shell',
            boundary_entity_id: 'missing_outline',
            name: 'Shell',
          },
          {
            id: 'allowance',
            type: 'seam_allowance',
            piece_id: 'missing_piece',
            default_offset_mm: 3,
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.errors.some((error) => error.path === 'entities[0].boundary_entity_id')).toBe(true)
    expect(result.errors.some((error) => error.path === 'entities[1].piece_id')).toBe(true)
  })
})
