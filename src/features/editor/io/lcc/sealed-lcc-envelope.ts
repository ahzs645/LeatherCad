import { assertImportTextBudget, assertImportTreeBudget } from '../import-budget'

export const SEALED_LCC_READER_VERSION = '4.2.0'
export type SealedLccErrorCode = 'invalid-envelope' | 'unsupported-version' | 'unsupported-encoding' | 'newer-reader' | 'invalid-integrity' | 'verifier-unavailable' | 'invalid-compression' | 'decoded-limit' | 'invalid-json' | 'unsupported-payload'

export class SealedLccError extends Error {
  readonly code: SealedLccErrorCode
  constructor(code: SealedLccErrorCode, message: string) {
    super(`Sealed LCC files: ${message}. The current document was not changed.`)
    this.name = 'SealedLccError'
    this.code = code
  }
}

export type SealedLccEnvelope = Readonly<{
  version: 1
  encoding: 'zlib+base64'
  requiredReader: string
  producerVersion: string | null
  dataText: string
  macHex: string
  compatibilityShapeCount: number
}>

export function isSealedLccContainer(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const meta = candidate.meta as Record<string, unknown> | undefined
  return 'sealed' in candidate || meta?.file_type === 'LeathercraftCAD_Sealed'
}

export function sealedLccVersion(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(value)
  return match ? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]) : null
}

export function parseSealedLccEnvelope(raw: string | unknown): SealedLccEnvelope {
  let value: unknown = raw
  if (typeof raw === 'string') {
    assertImportTextBudget(raw)
    try { value = JSON.parse(raw.replace(/^\uFEFF/, '')) } catch { throw new SealedLccError('invalid-envelope', 'the outer container is not valid JSON') }
  }
  assertImportTreeBudget(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SealedLccError('invalid-envelope', 'expected an object container')
  const candidate = value as Record<string, unknown>
  const meta = candidate.meta as Record<string, unknown> | undefined
  const sealed = candidate.sealed as Record<string, unknown> | undefined
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || meta.file_type !== 'LeathercraftCAD_Sealed' || !sealed || typeof sealed !== 'object' || Array.isArray(sealed)) throw new SealedLccError('invalid-envelope', 'expected LeathercraftCAD_Sealed metadata and a sealed object')
  if (sealed.ver !== 1) throw new SealedLccError('unsupported-version', `container version ${String(sealed.ver).slice(0, 30)} is unsupported (supported: 1)`)
  if (sealed.enc !== 'zlib+base64') throw new SealedLccError('unsupported-encoding', 'encoding is unsupported (supported: zlib+base64)')
  const required = sealedLccVersion(meta.min_reader)
  if (required === null) throw new SealedLccError('invalid-envelope', 'min_reader must be a three-part numeric version')
  if (required > sealedLccVersion(SEALED_LCC_READER_VERSION)!) throw new SealedLccError('newer-reader', `the file requires reader ${String(meta.min_reader)}, newer than supported reader ${SEALED_LCC_READER_VERSION}`)
  if (typeof sealed.data !== 'string' || !sealed.data.length || typeof sealed.mac !== 'string' || !/^[0-9a-f]{64}$/i.test(sealed.mac.trim())) throw new SealedLccError('invalid-envelope', 'data must be a nonempty string and mac must contain 64 hexadecimal characters')
  const canonical = sealed.data.replace(/\s/g, '')
  if (!canonical.length || canonical.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(canonical)) throw new SealedLccError('invalid-envelope', 'data is not valid padded base64')
  return Object.freeze({ version: 1, encoding: 'zlib+base64', requiredReader: meta.min_reader as string, producerVersion: typeof meta.version === 'string' ? meta.version.slice(0, 100) : null, dataText: sealed.data, macHex: sealed.mac.trim().toLowerCase(), compatibilityShapeCount: Array.isArray(candidate.shapes) ? candidate.shapes.length : 0 })
}
