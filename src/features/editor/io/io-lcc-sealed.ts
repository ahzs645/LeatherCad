import { MAX_IMPORT_FILE_BYTES } from './import-budget'
import { importLccDocument, type LccImportResult } from './io-lcc'
import { parseSealedLccEnvelope, SealedLccError, type SealedLccEnvelope } from './lcc/sealed-lcc-envelope'
import { referenceSealedLccV1VerificationKey } from './lcc/sealed-lcc-v1-verifier'
import { parseImportedJsonDocument } from '../editor-json-import'
import { parseSealedLccPayload as parsePayload } from './lcc/sealed-lcc-payload'

export type SealedLccVerificationRequest = Readonly<{ containerVersion: 1; encoding: 'zlib+base64'; dataText: string; expectedMacHex: string; signal?: AbortSignal }>
/** Trusted application configuration, never obtained from fields in a drawing. */
export type SealedLccVerifier = Readonly<{ id: string; verify: (request: SealedLccVerificationRequest) => Promise<boolean> }>
type DecodeOptions = { signal?: AbortSignal; maxDecodedBytes?: number }

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Import canceled', 'AbortError') }
const bytesFromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!, byte => parseInt(byte, 16))

/** Additional explicit verifiers can be supplied by trusted application code. */
export function createHmacSha256SealedLccVerifier(key: CryptoKey, options: { id?: string; subtle?: SubtleCrypto } = {}): SealedLccVerifier {
  const algorithm = key.algorithm as HmacKeyAlgorithm
  if (key.type !== 'secret' || algorithm.name !== 'HMAC' || algorithm.hash?.name !== 'SHA-256' || !key.usages.includes('verify')) throw new Error('A provisioned HMAC-SHA-256 verification key is required')
  const subtle = options.subtle ?? globalThis.crypto?.subtle
  if (!subtle) throw new Error('Web Crypto verification is unavailable')
  return Object.freeze({ id: options.id ?? 'operator-provisioned-hmac-sha256', verify: async (request: SealedLccVerificationRequest) => {
    checkAbort(request.signal)
    const valid = await subtle.verify('HMAC', key, bytesFromHex(request.expectedMacHex), new TextEncoder().encode(request.dataText))
    checkAbort(request.signal)
    return valid
  } })
}

function compressedBytes(envelope: SealedLccEnvelope): Uint8Array<ArrayBuffer> {
  const binary = atob(envelope.dataText.replace(/\s/g, ''))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function inflate(envelope: SealedLccEnvelope, options: DecodeOptions): Promise<{ text: string; compressedByteCount: number; decodedByteCount: number }> {
  checkAbort(options.signal)
  const maximum = options.maxDecodedBytes ?? MAX_IMPORT_FILE_BYTES
  if (!Number.isInteger(maximum) || maximum <= 0 || maximum > MAX_IMPORT_FILE_BYTES) throw new Error('Decoded payload limit must be between 1 byte and 50 MB')
  if (typeof DecompressionStream === 'undefined') throw new SealedLccError('invalid-compression', 'this runtime does not support zlib decompression')
  const compressed = compressedBytes(envelope)
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(compressed); controller.close() } })
  const reader = source.pipeThrough(new DecompressionStream('deflate')).getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  options.signal?.addEventListener('abort', cancel, { once: true })
  let decodedByteCount = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      checkAbort(options.signal)
      const { done, value } = await reader.read()
      checkAbort(options.signal)
      if (done) break
      decodedByteCount += value.byteLength
      if (decodedByteCount > maximum) { await reader.cancel(); throw new SealedLccError('decoded-limit', `decoded payload exceeds the ${maximum}-byte limit`) }
      chunks.push(value)
    }
  } catch (error) {
    checkAbort(options.signal)
    if (error instanceof SealedLccError) throw error
    throw new SealedLccError('invalid-compression', 'data is not a complete valid zlib stream')
  } finally {
    options.signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
  const decoded = new Uint8Array(decodedByteCount)
  let offset = 0
  for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.length }
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(decoded), compressedByteCount: compressed.byteLength, decodedByteCount } }
  catch { throw new SealedLccError('invalid-json', 'decoded bytes are not valid UTF-8') }
}

async function verifyEnvelope(envelope: SealedLccEnvelope, options: DecodeOptions & { verifier?: SealedLccVerifier }): Promise<string> {
  checkAbort(options.signal)
  const verifier = options.verifier ?? createHmacSha256SealedLccVerifier(await referenceSealedLccV1VerificationKey(), { id: 'reference-v1-format-integrity' })
  let valid: boolean
  try { valid = await verifier.verify(Object.freeze({ containerVersion: envelope.version, encoding: envelope.encoding, dataText: envelope.dataText, expectedMacHex: envelope.macHex, signal: options.signal })) }
  catch (error) { checkAbort(options.signal); if (error instanceof SealedLccError) throw error; throw new SealedLccError('verifier-unavailable', 'the configured verification provider failed') }
  checkAbort(options.signal)
  if (valid !== true) throw new SealedLccError('invalid-integrity', 'MAC verification failed; decoded content will not be imported')
  return verifier.id
}

/** Read-only protocol diagnostics. No document/geometry is returned for loading. */
export async function inspectSealedLccPayload(raw: string, options: DecodeOptions & { verifyIntegrity?: boolean; verifier?: SealedLccVerifier } = {}) {
  const envelope = parseSealedLccEnvelope(raw)
  const verifierId = options.verifyIntegrity === false ? null : await verifyEnvelope(envelope, options)
  const decoded = await inflate(envelope, options)
  const payload = parsePayload(decoded.text, { forImport: false })
  const typeCounts: Record<string, number> = Object.create(null) as Record<string, number>
  for (const shape of payload.shapes) {
    const type = shape && typeof shape === 'object' && typeof (shape as { type?: unknown }).type === 'string' ? String((shape as { type: string }).type).slice(0, 40) : '(invalid)'
    typeCounts[type] = (typeCounts[type] ?? 0) + 1
  }
  return { trustedForImport: false as const, integrity: verifierId ? 'verified-format-mac' as const : 'not-verified' as const, containerVersion: envelope.version, encoding: envelope.encoding, authentication: 'HMAC-SHA-256 over UTF-8 literal sealed.data text', requiredReader: envelope.requiredReader, producerVersion: envelope.producerVersion, compressedBytes: decoded.compressedByteCount, decodedBytes: decoded.decodedByteCount, innerFileType: payload.meta.file_type, innerVersion: payload.meta.version, sourceShapeCount: payload.shapes.length, shapeTypes: typeCounts, licenseRecordCount: Array.isArray(payload.meta.licenses) ? payload.meta.licenses.length : 0, licensedShapeCount: payload.shapes.filter(shape => shape && typeof shape === 'object' && (shape as { orig?: unknown }).orig != null).length, ignoredCompatibilityShapeCount: envelope.compatibilityShapeCount }
}

export async function importVerifiedSealedLccDocument(raw: string, options: DecodeOptions & { verifier?: SealedLccVerifier } = {}): Promise<LccImportResult & { integrity: { status: 'verified'; verifierId: string; compressedBytes: number; decodedBytes: number } }> {
  checkAbort(options.signal)
  const envelope = parseSealedLccEnvelope(raw)
  const verifierId = await verifyEnvelope(envelope, options)
  const decoded = await inflate(envelope, options)
  const payload = parsePayload(decoded.text)
  if ((payload.meta.licenses !== undefined && (!Array.isArray(payload.meta.licenses) || payload.meta.licenses.length > 0)) || payload.shapes.some(shape => shape && typeof shape === 'object' && (shape as { orig?: unknown }).orig != null)) throw new SealedLccError('unsupported-payload', 'the format MAC is valid, but licensed-part provenance cannot yet be preserved by this reader; keep this file in the original application')
  checkAbort(options.signal)
  const result = importLccDocument(decoded.text)
  const normalized = parseImportedJsonDocument(JSON.stringify(result.doc), { preserveShapeIds: true })
  return { ...result, doc: normalized.doc, integrity: { status: 'verified', verifierId, compressedBytes: decoded.compressedByteCount, decodedBytes: decoded.decodedByteCount } }
}
