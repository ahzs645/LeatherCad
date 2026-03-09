import { describe, expect, it } from 'vitest'
import { GUIDE_LINE_TYPE_ID, MARK_LINE_TYPE_ID } from '../cad/line-types'
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
    })
  })
})
