import type { DocFile } from '../cad/cad-types'
import { assertImportTextBudget } from './import-budget'

export type DocumentImportResult = { doc: DocFile; warnings: string[]; format: 'JSON' | 'LCAD' | 'LCC'; integrity?: { format: 'sealed-lcc-v1'; status: 'verified' } }

export async function importSerializedDocument(raw: string, fileName: string): Promise<DocumentImportResult> {
  assertImportTextBudget(raw)
  const trimmed = raw.replace(/^\uFEFF/, '').trim()
  if (!trimmed) throw new Error('File is empty — nothing to load')
  if (!trimmed.startsWith('{')) throw new Error('Expected a drawing JSON object')
  const candidate: unknown = JSON.parse(trimmed)
  const { isSealedLccContainer } = await import('./lcc/sealed-lcc-envelope')
  if (isSealedLccContainer(candidate)) {
    const { importVerifiedSealedLccDocument } = await import('./io-lcc-sealed')
    const result = await importVerifiedSealedLccDocument(raw)
    return { ...result, integrity: { format: 'sealed-lcc-v1', status: 'verified' }, format: 'LCC' }
  }
  const meta = candidate && typeof candidate === 'object' ? (candidate as { meta?: { file_type?: unknown } }).meta : undefined
  if (fileName.toLowerCase().endsWith('.lcc') || meta?.file_type === 'LeathercraftCAD') {
    const { importLccDocument } = await import('./io-lcc')
    return { ...importLccDocument(raw), format: 'LCC' }
  }
  const { importLcadDocument, isLcadDocument } = await import('./io-lcad')
  if (fileName.toLowerCase().endsWith('.lcad') || isLcadDocument(candidate)) return { ...importLcadDocument(raw), format: 'LCAD' }
  const { parseImportedJsonDocument } = await import('../editor-json-import')
  return { ...parseImportedJsonDocument(raw), warnings: [], format: 'JSON' }
}
