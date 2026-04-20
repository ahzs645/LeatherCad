import type { DocFile } from '../cad/cad-types'
import { importLccDocument } from './io-lcc'
import { createTemplateFromDoc, type TemplateRepositoryEntry } from '../templates/template-repository'
import { parseImportedJsonDocument } from '../editor-json-import'

const EOCD_SIGNATURE = 0x06054b50
const CD_SIGNATURE = 0x02014b50
const LFH_SIGNATURE = 0x04034b50

type ZipEntry = {
  name: string
  data: Uint8Array
}

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}
function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

/**
 * Locate the End-of-Central-Directory record by scanning backward from the
 * end of the archive for the EOCD signature (0x06054b50).
 */
function findEocd(view: DataView): number | null {
  const size = view.byteLength
  const maxScan = Math.min(size, 65557)
  for (let offset = size - 22; offset >= size - maxScan; offset -= 1) {
    if (offset < 0) break
    if (u32(view, offset) === EOCD_SIGNATURE) {
      return offset
    }
  }
  return null
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available in this environment')
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Minimal ZIP reader. Handles stored (method 0) and deflate (method 8) entries,
 * which covers every file the original Leathercraft CAD app produces.
 */
export async function readZipEntries(fileBytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength)
  const eocdOffset = findEocd(view)
  if (eocdOffset === null) {
    throw new Error('Not a ZIP file (end-of-central-directory record not found)')
  }
  const entryCount = u16(view, eocdOffset + 10)
  const cdSize = u32(view, eocdOffset + 12)
  const cdOffset = u32(view, eocdOffset + 16)

  const entries: ZipEntry[] = []
  let cursor = cdOffset
  const cdEnd = cdOffset + cdSize
  const decoder = new TextDecoder('utf-8', { fatal: false })

  for (let index = 0; index < entryCount && cursor < cdEnd; index += 1) {
    if (u32(view, cursor) !== CD_SIGNATURE) {
      throw new Error('Corrupt ZIP: central directory signature mismatch')
    }
    const compressionMethod = u16(view, cursor + 10)
    const compressedSize = u32(view, cursor + 20)
    const fileNameLength = u16(view, cursor + 28)
    const extraLength = u16(view, cursor + 30)
    const commentLength = u16(view, cursor + 32)
    const localHeaderOffset = u32(view, cursor + 42)

    const nameBytes = fileBytes.subarray(cursor + 46, cursor + 46 + fileNameLength)
    const name = decoder.decode(nameBytes)

    cursor += 46 + fileNameLength + extraLength + commentLength

    if (name.endsWith('/')) {
      // directory entry
      continue
    }

    if (u32(view, localHeaderOffset) !== LFH_SIGNATURE) {
      throw new Error(`Corrupt ZIP: local header mismatch for ${name}`)
    }
    const lhNameLength = u16(view, localHeaderOffset + 26)
    const lhExtraLength = u16(view, localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + lhNameLength + lhExtraLength
    const compressedData = fileBytes.subarray(dataStart, dataStart + compressedSize)

    let data: Uint8Array
    if (compressionMethod === 0) {
      data = compressedData
    } else if (compressionMethod === 8) {
      data = await inflateRaw(compressedData)
    } else {
      // Skip unsupported compression rather than blowing up the whole import.
      continue
    }

    entries.push({ name, data })
  }

  return entries
}

function docFromEntryBytes(bytes: Uint8Array, entryName: string): DocFile | null {
  let text: string
  try {
    text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return null
  }
  const lower = entryName.toLowerCase()
  // LCC-native format first — the source app writes .lcc files.
  if (lower.endsWith('.lcc') || lower.endsWith('.lcc.json')) {
    try {
      return importLccDocument(text).doc
    } catch {
      // fall through to try JSON
    }
  }
  if (lower.endsWith('.json')) {
    // Try LeatherCad's own JSON first, then LCC as a fallback.
    try {
      return parseImportedJsonDocument(text).doc
    } catch {
      try {
        return importLccDocument(text).doc
      } catch {
        return null
      }
    }
  }
  return null
}

function prettyNameFor(entryName: string): string {
  const base = entryName.split('/').pop() ?? entryName
  return base.replace(/\.(lcc|json)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported template'
}

export type RepositoryZipImportResult = {
  entries: TemplateRepositoryEntry[]
  skipped: Array<{ name: string; reason: string }>
}

/**
 * Parse a Leathercraft CAD repository `.zip` and convert every supported
 * template file inside into a LeatherCad TemplateRepositoryEntry.
 *
 * The original app's `uRepositoryZip` format is closed-source; this importer
 * makes a best-effort pass that handles `.lcc` and JSON-shaped entries and
 * skips anything it doesn't recognize (binary thumbnails, manifest files,
 * etc.) while reporting them so the user knows what was dropped.
 */
export async function importRepositoryZip(fileBytes: Uint8Array): Promise<RepositoryZipImportResult> {
  const entries = await readZipEntries(fileBytes)
  const templates: TemplateRepositoryEntry[] = []
  const skipped: Array<{ name: string; reason: string }> = []

  for (const entry of entries) {
    const doc = docFromEntryBytes(entry.data, entry.name)
    if (!doc) {
      skipped.push({ name: entry.name, reason: 'unsupported entry type' })
      continue
    }
    templates.push(createTemplateFromDoc(prettyNameFor(entry.name), doc))
  }

  return { entries: templates, skipped }
}
