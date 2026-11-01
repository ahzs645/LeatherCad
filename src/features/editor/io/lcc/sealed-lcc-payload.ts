import { assertImportGeometryBudget, assertImportLayerBudget, assertImportTextBudget, assertImportTreeBudget } from '../import-budget'
import { SealedLccError } from './sealed-lcc-envelope'

export type SealedLccPayload = { meta: Record<string, unknown>; shapes: Array<Record<string, unknown>> }
const supportedShapes = new Set(['LINE', 'ARC', 'BEZIER', 'ELLIPSE', 'DOT', 'S_HOLE', 'TEXT', 'OTHER', 'DIMENSION'])
const pointKeys = ['sp', 'ep', 'ct', 'bz1', 'bz2', 'dp1', 'dp2', 'dctr', 'StcIn', 'StcOut']
const numericKeys = ['w', 'h', 'rt', 'thk', 'sta', 'swa', 'fs', 'txst', 'txrd', 'la', 'lb', 'doff', 'dprec', 'drad', 'dgap']
const point = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every(number => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 1e9)
const id = (value: unknown) => (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isInteger(value))
const numeric = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0)) && Number.isFinite(Number(value))

export function parseSealedLccPayload(text: string, options: { forImport?: boolean } = {}): SealedLccPayload {
  assertImportTextBudget(text)
  let value: unknown
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new SealedLccError('invalid-json', 'decoded payload is not valid JSON; automatic repair is not applied') }
  assertImportTreeBudget(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SealedLccError('unsupported-payload', 'decoded payload must be a legacy LCC object')
  const payload = value as { meta?: Record<string, unknown>; shapes?: unknown[]; layers?: unknown[]; sealed?: unknown }
  if (!payload.meta || payload.meta.file_type !== 'LeathercraftCAD' || payload.meta.version !== '4.2.0' || !Array.isArray(payload.shapes) || !Array.isArray(payload.layers) || 'sealed' in payload) throw new SealedLccError('unsupported-payload', 'supported inner schema is plain LeathercraftCAD version 4.2.0 with shapes and layers arrays')
  assertImportGeometryBudget(payload.shapes.length)
  assertImportLayerBudget(payload.layers.length)
  if (options.forImport === false) return { meta: payload.meta, shapes: payload.shapes as Array<Record<string, unknown>> }
  const layers = new Set<string>(), ids = new Set<string>()
  for (const layer of payload.layers) {
    if (!layer || typeof layer !== 'object' || !id((layer as { id?: unknown }).id)) throw new SealedLccError('unsupported-payload', 'invalid inner layer ID')
    const layerId = String((layer as { id: unknown }).id)
    if (layers.has(layerId)) throw new SealedLccError('unsupported-payload', 'duplicate inner layer ID')
    if ((layer as { nam?: unknown }).nam !== undefined && typeof (layer as { nam?: unknown }).nam !== 'string') throw new SealedLccError('unsupported-payload', 'invalid inner layer name')
    layers.add(layerId)
  }
  for (const shape of payload.shapes) {
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) throw new SealedLccError('unsupported-payload', 'inner shapes must be objects')
    const item = shape as Record<string, unknown>
    if (typeof item.id !== 'string' || !item.id.length || ids.has(item.id)) throw new SealedLccError('unsupported-payload', 'inner shape IDs must be unique nonempty strings')
    ids.add(String(item.id))
    if (typeof item.type !== 'string' || !supportedShapes.has(item.type)) throw new SealedLccError('unsupported-payload', `unsupported inner shape type: ${String(item.type).slice(0, 40)}`)
    if (!layers.has(String(item.layer))) throw new SealedLccError('unsupported-payload', 'a shape references a missing inner layer')
    for (const key of ['sp', 'ep', 'ct']) if (!point(item[key])) throw new SealedLccError('unsupported-payload', `invalid inner ${key} point`)
    for (const key of pointKeys) if (item[key] !== undefined && !point(item[key])) throw new SealedLccError('unsupported-payload', `invalid inner ${key} point`)
    if (item.type === 'LINE' || item.type === 'BEZIER') for (const key of ['bz1', 'bz2']) if (!point(item[key])) throw new SealedLccError('unsupported-payload', `missing inner ${key} control point`)
    for (const key of numericKeys) if (item[key] !== undefined && !numeric(item[key])) throw new SealedLccError('unsupported-payload', `invalid numeric inner ${key}`)
    for (const key of ['path', 'color', 'dash', 'tx', 'ff', 'nm', 'gid', 'dim']) if (item[key] !== undefined && typeof item[key] !== 'string') throw new SealedLccError('unsupported-payload', `invalid inner ${key} text`)
    if (item.thk !== undefined && (Number(item.thk) < 0 || Number(item.thk) > 20)) throw new SealedLccError('unsupported-payload', 'inner stroke width is outside the supported 0–20 mm range')
    if (item.opc !== undefined && (!numeric(item.opc) || Number(item.opc) < 0 || Number(item.opc) > 1)) throw new SealedLccError('unsupported-payload', 'invalid inner opacity')
    for (const key of ['NextStId', 'PrevStId']) if (item[key] !== undefined && typeof item[key] !== 'string') throw new SealedLccError('unsupported-payload', 'inner stitch-link IDs must be strings')
    if ((item.type === 'TEXT' || item.type === 'DIMENSION') && !(Number(item.fs) > 0)) throw new SealedLccError('unsupported-payload', 'invalid inner font size')
    if (item.type === 'DIMENSION' && (item.dk !== 'linear' || !point(item.dp1) || !point(item.dp2))) throw new SealedLccError('unsupported-payload', `unsupported inner DIMENSION kind: ${String(item.dk).slice(0, 30)}; this reader currently supports linear dimensions`)
  }
  const backdrops = (value as { backdrops?: unknown }).backdrops
  if (backdrops !== undefined && !Array.isArray(backdrops)) throw new SealedLccError('unsupported-payload', 'inner backdrops must be an array')
  for (const entry of Array.isArray(backdrops) ? backdrops : []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new SealedLccError('unsupported-payload', 'invalid inner backdrop')
    const image = entry as Record<string, unknown>
    for (const key of ['w', 'h', 'dpi']) if (image[key] !== undefined && (!numeric(image[key]) || Number(image[key]) <= 0)) throw new SealedLccError('unsupported-payload', `invalid inner backdrop ${key}`)
    for (const key of ['angle', 'alpha', 'opc']) if (image[key] !== undefined && !numeric(image[key])) throw new SealedLccError('unsupported-payload', `invalid inner backdrop ${key}`)
    for (const key of ['alpha', 'opc']) if (image[key] !== undefined && (Number(image[key]) < 0 || Number(image[key]) > 1)) throw new SealedLccError('unsupported-payload', 'invalid inner backdrop opacity')
    if (image.topleft !== undefined && !point(image.topleft)) throw new SealedLccError('unsupported-payload', 'invalid inner backdrop origin')
    if (image.rotc !== undefined && !point(image.rotc)) throw new SealedLccError('unsupported-payload', 'invalid inner backdrop rotation centre')
    if (image.image !== undefined) {
      const embedded = image.image as Record<string, unknown> | null
      if (!embedded || typeof embedded !== 'object' || typeof embedded.mime !== 'string' || !/^image\/(?:png|jpeg|webp)$/i.test(embedded.mime) || typeof embedded.base64 !== 'string' || !embedded.base64.length) throw new SealedLccError('unsupported-payload', 'invalid inner embedded backdrop')
      const encoded = embedded.base64.replace(/\s/g, '')
      if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new SealedLccError('unsupported-payload', 'invalid inner backdrop base64')
      for (const key of ['pxw', 'pxh']) if (!numeric(embedded[key]) || Number(embedded[key]) <= 0 || !Number.isInteger(Number(embedded[key]))) throw new SealedLccError('unsupported-payload', `invalid inner backdrop ${key}`)
    }
  }
  return { meta: payload.meta, shapes: payload.shapes as Array<Record<string, unknown>> }
}
