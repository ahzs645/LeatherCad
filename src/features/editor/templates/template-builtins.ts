import type { DocFile, Layer, Shape } from '../cad/cad-types'
import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  GUIDE_LINE_TYPE_ID,
  STITCH_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'
import type { TemplateRepositoryEntry } from './template-repository'

const BUILTIN_TEMPLATE_TIMESTAMP = '2026-01-01T00:00:00.000Z'

function slugifyId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function makeLayer(id: string, name: string): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    stackLevel: 0,
  }
}

function line(id: string, layerId: string, x1: number, y1: number, x2: number, y2: number, lineTypeId: string): Shape {
  return {
    id,
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

function rectangle(
  idPrefix: string,
  layerId: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  lineTypeId: string,
): Shape[] {
  return [
    line(`${idPrefix}-top`, layerId, minX, minY, maxX, minY, lineTypeId),
    line(`${idPrefix}-right`, layerId, maxX, minY, maxX, maxY, lineTypeId),
    line(`${idPrefix}-bottom`, layerId, maxX, maxY, minX, maxY, lineTypeId),
    line(`${idPrefix}-left`, layerId, minX, maxY, minX, minY, lineTypeId),
  ]
}

function centerGuides(idPrefix: string, layerId: string, widthMm: number, heightMm: number): Shape[] {
  return [
    line(`${idPrefix}-center-x`, layerId, -widthMm / 2, 0, widthMm / 2, 0, GUIDE_LINE_TYPE_ID),
    line(`${idPrefix}-center-y`, layerId, 0, -heightMm / 2, 0, heightMm / 2, GUIDE_LINE_TYPE_ID),
  ]
}

function stitchBox(idPrefix: string, layerId: string, widthMm: number, heightMm: number, insetMm: number): Shape[] {
  const halfWidth = widthMm / 2
  const halfHeight = heightMm / 2
  if (halfWidth - insetMm <= 0 || halfHeight - insetMm <= 0) {
    return []
  }
  return rectangle(
    `${idPrefix}-stitch`,
    layerId,
    -halfWidth + insetMm,
    -halfHeight + insetMm,
    halfWidth - insetMm,
    halfHeight - insetMm,
    STITCH_LINE_TYPE_ID,
  )
}

function makeReferenceDoc(name: string, widthMm: number, heightMm: number, stitchInsetMm: number): DocFile {
  const idBase = slugifyId(name)
  const layer = makeLayer(`${idBase}-layer`, `${name} Reference`)
  const halfWidth = widthMm / 2
  const halfHeight = heightMm / 2
  const objects: Shape[] = [
    ...rectangle(`${idBase}-outline`, layer.id, -halfWidth, -halfHeight, halfWidth, halfHeight, CUT_LINE_TYPE_ID),
    ...stitchBox(idBase, layer.id, widthMm, heightMm, stitchInsetMm),
    ...centerGuides(idBase, layer.id, widthMm, heightMm),
    {
      id: `${idBase}-label`,
      type: 'text',
      layerId: layer.id,
      lineTypeId: GUIDE_LINE_TYPE_ID,
      start: { x: -halfWidth, y: halfHeight + 8 },
      end: { x: halfWidth, y: halfHeight + 8 },
      text: `${name} ${widthMm.toFixed(2)} x ${heightMm.toFixed(2)} mm`,
      fontFamily: 'Georgia, serif',
      fontSizeMm: 4,
      transform: 'none',
      radiusMm: 40,
      sweepDeg: 140,
    },
  ]

  return {
    version: 1,
    units: 'mm',
    layers: [layer],
    activeLayerId: layer.id,
    lineTypes: createDefaultLineTypes(),
    activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
    objects,
    foldLines: [],
  }
}

export function createBuiltinTemplateRepository(): TemplateRepositoryEntry[] {
  const entries: Array<{ id: string; name: string; doc: DocFile }> = [
    {
      id: 'builtin-template-credit-card-id1',
      name: 'Credit Card ID-1 Reference',
      doc: makeReferenceDoc('Credit Card ID-1', 85.6, 53.98, 3),
    },
    {
      id: 'builtin-template-business-card',
      name: 'Business Card Reference',
      doc: makeReferenceDoc('Business Card', 90, 55, 3),
    },
    {
      id: 'builtin-template-passport-pocket',
      name: 'Passport Pocket Reference',
      doc: makeReferenceDoc('Passport Pocket', 125, 88, 4),
    },
  ]

  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    createdAt: BUILTIN_TEMPLATE_TIMESTAMP,
    updatedAt: BUILTIN_TEMPLATE_TIMESTAMP,
    doc: entry.doc,
  }))
}
