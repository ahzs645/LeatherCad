import type { DocFile } from '../cad/cad-types'
import { assertImportTextBudget } from './import-budget'

export type DocumentImportResult = { doc: DocFile; warnings: string[]; format: 'JSON' | 'LCAD' | 'LCC' }

export async function importSerializedDocument(raw: string, fileName: string): Promise<DocumentImportResult> {
  assertImportTextBudget(raw)
  const trimmed = raw.replace(/^\uFEFF/, '').trim()
  if (!trimmed) throw new Error('File is empty — nothing to load')
  if (fileName.toLowerCase().endsWith('.lcc')) {
    const { importLccDocument } = await import('./io-lcc')
    return { ...importLccDocument(raw), format: 'LCC' }
  }
  if (!trimmed.startsWith('{')) throw new Error('Expected a drawing JSON object')
  const { importLcadDocument, isLcadDocument } = await import('./io-lcad')
  if (fileName.toLowerCase().endsWith('.lcad') || isLcadDocument(JSON.parse(trimmed))) return { ...importLcadDocument(raw), format: 'LCAD' }
  const { parseImportedJsonDocument } = await import('../editor-json-import')
  return { ...parseImportedJsonDocument(raw), warnings: [], format: 'JSON' }
}
