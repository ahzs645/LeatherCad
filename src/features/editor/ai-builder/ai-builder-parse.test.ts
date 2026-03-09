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
})
