// @vitest-environment node
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { importSerializedDocument } from './document-import'
import { importLccDocument } from './io-lcc'
import { createHmacSha256SealedLccVerifier, importVerifiedSealedLccDocument, inspectSealedLccPayload, type SealedLccVerifier } from './io-lcc-sealed'
import { parseSealedLccEnvelope } from './lcc/sealed-lcc-envelope'

const reference = readFileSync(new URL('../../../../docs/fixtures/interchange/reference-sealed-rectangle.lcc', import.meta.url), 'utf8')
type TestContainer = { meta: { file_type: string; version: string; min_reader: string }; sealed: { ver: number; enc: string; data: string; mac: string }; shapes: unknown[] }
type TestPayload = { meta: Record<string, unknown>; layers: Array<Record<string, unknown>>; shapes: Array<Record<string, unknown>>; backdrops?: unknown[]; groups?: unknown[] }
const referenceOuter = JSON.parse(reference.replace(/^\uFEFF/, '')) as TestContainer
const referenceInner = JSON.parse(inflateSync(Buffer.from(referenceOuter.sealed.data, 'base64')).toString('utf8')) as TestPayload
const testKey = Buffer.from('LeatherCad owned synthetic test-only key')
let verifier: SealedLccVerifier
beforeAll(async () => {
  const key = await crypto.subtle.importKey('raw', testKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  verifier = createHmacSha256SealedLccVerifier(key, { id: 'owned-synthetic-test' })
})
const inner = () => structuredClone(referenceInner)
const line = (id = '1') => ({ ...structuredClone(referenceInner.shapes[0]), id })
function sealBytes(bytes: Uint8Array, transformData = (data: string) => data) {
  const data = transformData(deflateSync(bytes).toString('base64'))
  return JSON.stringify({ ...referenceOuter, sealed: { ver: 1, enc: 'zlib+base64', data, mac: createHmac('sha256', testKey).update(data).digest('hex') } })
}
const seal = (payload: unknown) => sealBytes(Buffer.from(JSON.stringify(payload)))
const load = (payload: unknown) => importVerifiedSealedLccDocument(seal(payload), { verifier })
const changeOuter = (change: (value: typeof referenceOuter) => void) => { const value = structuredClone(referenceOuter); change(value); return JSON.stringify(value) }

describe('sealed LCC v1 observed-format compatibility', () => {
  it('verifies an original-runtime-produced own fixture with the default reader and loads its real rectangle', async () => {
    const result = await importVerifiedSealedLccDocument(reference)
    expect(result.integrity).toEqual({ status: 'verified', verifierId: 'reference-v1-format-integrity', compressedBytes: 610, decodedBytes: 2259 })
    expect(result.summary).toMatchObject({ shapeCount: 4, stitchHoleCount: 0, foldCount: 0 })
    expect(result.warnings).toEqual([])
    const points = result.doc.objects.flatMap(shape => shape.type === 'line' ? [shape.start, shape.end] : [])
    expect(points).toHaveLength(8)
    expect(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))).toBe(24)
    expect(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))).toBe(16)
    for (const shape of result.doc.objects) {
      expect(shape.type).toBe('line')
      expect(shape.opacity).toBe(1)
      expect(result.doc.lineTypes.find(type => type.id === shape.lineTypeId)?.strokeWidthMm).toBe(1.5)
    }
  })

  it('routes genuine sealed content to verification even with a renamed JSON extension', async () => {
    const result = await importSerializedDocument(reference, 'renamed.json')
    expect(result.integrity).toEqual({ format: 'sealed-lcc-v1', status: 'verified' })
    expect(result.doc.objects).toHaveLength(4)
    expect(() => importLccDocument(reference)).toThrow(/asynchronous verified reader/)
  })

  it.each([
    ['MAC', (value: typeof referenceOuter) => { value.sealed.mac = '0'.repeat(64) }],
    ['data', (value: typeof referenceOuter) => { value.sealed.data = (value.sealed.data[0] === 'A' ? 'B' : 'A') + value.sealed.data.slice(1) }],
    ['whitespace added to literal data', (value: typeof referenceOuter) => { value.sealed.data = `\n${value.sealed.data}` }],
  ])('rejects changed %s before trusting the payload', async (_label, change) => {
    await expect(importVerifiedSealedLccDocument(changeOuter(change))).rejects.toMatchObject({ code: 'invalid-integrity' })
  })

  it.each([
    ['unsupported-version', (value: typeof referenceOuter) => { value.sealed.ver = 2 }],
    ['unsupported-encoding', (value: typeof referenceOuter) => { value.sealed.enc = 'gzip+base64' }],
    ['newer-reader', (value: typeof referenceOuter) => { value.meta.min_reader = '4.2.1' }],
    ['invalid-envelope', (value: typeof referenceOuter) => { value.meta.min_reader = '4.2' }],
    ['invalid-envelope', (value: typeof referenceOuter) => { value.sealed.mac = 'wrong' }],
    ['invalid-envelope', (value: typeof referenceOuter) => { value.sealed.data = '====' }],
  ])('reports the explicit %s gate', async (code, change) => {
    await expect(importVerifiedSealedLccDocument(changeOuter(change))).rejects.toMatchObject({ code })
  })

  it('accepts source-compatible MAC casing and signed base64 whitespace without canonicalizing before MAC verification', async () => {
    const uppercase = changeOuter(value => { value.sealed.mac = ` ${value.sealed.mac.toUpperCase()} ` })
    expect((await importVerifiedSealedLccDocument(uppercase)).doc.objects).toHaveLength(4)
    const wrapped = sealBytes(Buffer.from(JSON.stringify(inner())), data => `\n${data.slice(0, 40)}\r\n${data.slice(40)}\n`)
    expect((await importVerifiedSealedLccDocument(wrapped, { verifier })).doc.objects).toHaveLength(4)
  })

  it('rejects an invalid zlib stream despite a valid test-owned MAC', async () => {
    const data = Buffer.from('not a zlib stream').toString('base64')
    const outer = JSON.parse(seal(inner())) as TestContainer
    outer.sealed.data = data
    outer.sealed.mac = createHmac('sha256', testKey).update(data).digest('hex')
    await expect(importVerifiedSealedLccDocument(JSON.stringify(outer), { verifier })).rejects.toMatchObject({ code: 'invalid-compression' })
  })

  it('rejects truncated zlib streams and checksum corruption', async () => {
    const compressed = deflateSync(Buffer.from(JSON.stringify(inner())))
    for (const bytes of [compressed.subarray(0, compressed.length - 3), Buffer.from(compressed)]) {
      if (bytes.length === compressed.length) bytes[bytes.length - 1] ^= 1
      const data = bytes.toString('base64'), outer = JSON.parse(seal(inner())) as TestContainer
      outer.sealed = { ver: 1, enc: 'zlib+base64', data, mac: createHmac('sha256', testKey).update(data).digest('hex') }
      await expect(importVerifiedSealedLccDocument(JSON.stringify(outer), { verifier })).rejects.toMatchObject({ code: 'invalid-compression' })
    }
  })

  it.each([Buffer.from([0xff, 0xfe, 0xfd]), Buffer.from('{not-json')])('rejects invalid UTF-8 or JSON without repair', async bytes => {
    await expect(importVerifiedSealedLccDocument(sealBytes(bytes), { verifier })).rejects.toMatchObject({ code: 'invalid-json' })
  })

  it('bounds inflation independently from the compressed file size', async () => {
    const value = inner(); value.meta.memo = 'x'.repeat(250_000)
    const raw = seal(value)
    expect(parseSealedLccEnvelope(raw).dataText.length).toBeLessThan(10_000)
    await expect(importVerifiedSealedLccDocument(raw, { verifier, maxDecodedBytes: 32_768 })).rejects.toMatchObject({ code: 'decoded-limit' })
  })

  it('cancels before verification and after an asynchronous verifier completes', async () => {
    const first = new AbortController(); first.abort()
    await expect(importVerifiedSealedLccDocument(reference, { signal: first.signal })).rejects.toMatchObject({ name: 'AbortError' })
    const second = new AbortController()
    let finish!: (value: boolean) => void
    const pending = importVerifiedSealedLccDocument(reference, { signal: second.signal, verifier: { id: 'deferred-test', verify: () => new Promise(resolve => { finish = resolve }) } })
    second.abort(); finish(true)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('exposes read-only diagnostics separately from import, with honest integrity status', async () => {
    const result = await inspectSealedLccPayload(reference)
    expect(result).toMatchObject({ trustedForImport: false, integrity: 'verified-format-mac', containerVersion: 1, innerVersion: '4.2.0', sourceShapeCount: 4, shapeTypes: { LINE: 4 }, ignoredCompatibilityShapeCount: 1 })
    expect(result).not.toHaveProperty('doc')
    const unverified = await inspectSealedLccPayload(changeOuter(value => { value.sealed.mac = '0'.repeat(64) }), { verifyIntegrity: false })
    expect(unverified).toMatchObject({ trustedForImport: false, integrity: 'not-verified' })
    expect(Object.isFrozen(parseSealedLccEnvelope(reference))).toBe(true)
  })
})

describe('verified payload is still validated as untrusted document data', () => {
  it.each([
    ['file type', (value: typeof referenceInner) => { value.meta.file_type = 'DifferentCAD' }],
    ['inner version', (value: typeof referenceInner) => { value.meta.version = '4.3.0' }],
    ['shape type', (value: typeof referenceInner) => { value.shapes[0].type = 'UNKNOWN' }],
    ['point', (value: typeof referenceInner) => { value.shapes[0].sp = ['invalid', 0] }],
    ['numeric ID', (value: typeof referenceInner) => { value.shapes[0].id = 1 }],
    ['numeric stitch ref', (value: typeof referenceInner) => { value.shapes[0].NextStId = 2 }],
    ['missing layer', (value: typeof referenceInner) => { value.shapes[0].layer = 'absent' }],
    ['stroke width', (value: typeof referenceInner) => { value.shapes[0].thk = 'NaN' }],
    ['opacity', (value: typeof referenceInner) => { value.shapes[0].opc = false }],
    ['licensed records', (value: typeof referenceInner) => { value.meta.licenses = [{ item: 'owned-test-provenance' }] }],
    ['shape provenance', (value: typeof referenceInner) => { value.shapes[0].orig = { sid: 'synthetic' } }],
    ['radius dimension', (value: typeof referenceInner) => { Object.assign(value.shapes[0], { type: 'DIMENSION', dk: 'radius', dp1: [0, 0], dp2: [10, 0] }) }],
    ['image geometry', (value: typeof referenceInner) => { value.backdrops = [{ w: -1, h: 10 }] }],
  ])('rejects unsupported/invalid %s without granting privileges for a valid MAC', async (_label, change) => {
    const value = inner(); change(value)
    await expect(load(value)).rejects.toMatchObject({ code: 'unsupported-payload' })
  })

  it('normalizes numeric layer references without silently moving geometry to layer zero', async () => {
    const value = inner()
    value.layers.push({ id: 1, nam: 'Second', chk: '-1' })
    value.shapes[0].layer = 1
    const result = await load(value)
    expect(result.doc.objects[0].layerId).toBe(result.doc.layers.find(layer => layer.name === 'Second')?.id)
    expect(result.doc.foldLines).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('review line roles')
  })

  it('preserves two linked string-ID stitch holes as one chain', async () => {
    const value = inner()
    value.shapes = [{ ...line('1'), type: 'S_HOLE', w: '1', h: '1', NextStId: '2', PrevStId: '-1' }, { ...line('2'), type: 'S_HOLE', w: '1', h: '1', NextStId: '-1', PrevStId: '1', sp: [10, 0] }]
    const holes = (await load(value)).doc.stitchHoles!
    expect(holes).toHaveLength(2)
    expect(new Set(holes.map(hole => hole.chainId)).size).toBe(1)
    expect(holes.map(hole => hole.sequence).sort()).toEqual([0, 1])
  })

  it('preserves supported nested groups, opacity, physical widths, memo and embedded tracing metadata', async () => {
    const value = inner()
    value.groups = [{ id: 1, parent: 2 }, { id: 2, parent: -1 }]
    value.meta.memo = 'Own project memo'
    Object.assign(value.shapes[0], { gid: '1', opc: '0.25', thk: '0.05' })
    value.backdrops = [{ fullpath: 'own-tracing.png', image: { mime: 'image/png', base64: 'aGVsbG8=', pxw: 20, pxh: 10 }, topleft: [3, 4], rotc: [7, 8], w: '40', h: '20', angle: '12', dpi: '300', alpha: '0', visible: true }]
    const result = await load(value), groups = result.doc.sketchGroups!
    expect(groups).toHaveLength(2)
    expect(groups[0].parentId).toBe(groups[1].id)
    expect(result.doc.objects[0]).toMatchObject({ groupId: groups[0].id, opacity: 0.25, strokeWidthOverride: 0.05 })
    expect(result.doc.projectMemo).toBe('Own project memo')
    expect(result.doc.backdrops?.[0]).toMatchObject({ name: 'own-tracing.png', bitmapWidth: 20, bitmapHeight: 10, leftTop: { x: 3, y: 4 }, rotationCenter: { x: 7, y: 8 }, width: 40, height: 20, angleDeg: 12, dpi: 300, opacity: 0 })
  })

  it('maps observed native linear dimensions with explicit detached-association review', async () => {
    const value = inner()
    value.shapes.push({ ...line('dimension'), type: 'DIMENSION', dk: 'linear', dp1: [-25, -19], dp2: [-1, -19], doff: '-5', dprec: '2', dunit: '1', fs: '3.816794', dlbl: 'Width', tx: 'Width', dsl: '-1', dti: '-1', dao: '0', dtr: '0' })
    const result = await load(value)
    expect(result.doc.dimensionLines).toHaveLength(1)
    expect(result.doc.dimensionLines?.[0]).toMatchObject({ start: { x: -25, y: -19 }, end: { x: -1, y: -19 }, offsetMm: -5, text: 'Width', precision: 2, singleLine: true, textInside: true, arrowOnly: false })
    expect(result.warnings.join(' ')).toContain('detached annotations')
  })

  it('caps only superlinear legacy dimension reconstruction, leaving ordinary large patterns and native dimensions available', async () => {
    const value = inner()
    value.shapes = Array.from({ length: 2049 }, (_, index) => ({ ...line(String(index)), dim: '-1' }))
    await expect(load(value)).rejects.toThrow(/2,048 legacy dimension-reconstruction primitive limit/)
    value.shapes = Array.from({ length: 3000 }, (_, index) => line(String(index)))
    expect((await load(value)).doc.objects).toHaveLength(3000)
  })
})
