import '../pdf-worker'
import { getDocument } from '../pdfjs'
import { buildPatternPdfImportFromPage, type PatternPdfImport } from './pattern-pdf-import'
import { readPdfVectorPage, type PdfVectorPage } from './pdf-vector-source'

export type PatternPdfPageReview = {
  pageNumber: number
  page: PdfVectorPage | null
  result: PatternPdfImport | null
  confidence: 'review' | 'low'
  issues: string[]
  score: number
}

export type PatternPdfReview = {
  fileName: string
  pages: PatternPdfPageReview[]
  suggestedPageNumber: number
}

export function reviewPatternPdfPage(page: PdfVectorPage, documentName: string): PatternPdfPageReview {
  const result = buildPatternPdfImportFromPage(page, { documentName })
  const { analysis } = result
  const runs = analysis.pieces.flatMap((piece) => piece.stitchRuns)
  const issues = [...result.warnings]
  if (analysis.pieces.length === 0) issues.push('No usable pattern outline was detected. This may be an instruction or image-only page.')
  const irregularRuns = runs.filter((run) => run.pitchMm <= 0 || run.pitchSpreadMm / run.pitchMm > 0.15)
  if (irregularRuns.length) issues.push(`${irregularRuns.length} stitch run(s) have irregular spacing; printed marks may have been mistaken for stitching.`)
  const pitches = runs.map((run) => run.pitchMm).filter((pitch) => pitch > 0)
  if (pitches.length > 1 && Math.max(...pitches) / Math.min(...pitches) > 1.2) issues.push('Stitch runs disagree on pitch. Check each piece before accepting inferred stitching.')
  if (analysis.stitching.totalHoles > 0 && analysis.stitching.totalHoles < 6) issues.push('Very few stitch marks were detected. Hardware or decoration can resemble stitching.')
  if (analysis.strayDotCount > analysis.stitching.totalHoles && analysis.strayDotCount > 0) issues.push('Many marks fall outside detected pieces; review page selection and stitching.')
  if (result.doc.foldLines.length || result.doc.seamConnections?.length) issues.push('Fold lines and seam matches are inferred from geometry. Their direction and assembly still need review.')
  return {
    pageNumber: page.pageNumber, page, result,
    confidence: issues.length ? 'low' : 'review', issues,
    score: analysis.pieces.length * 10 + Math.min(analysis.stitching.totalHoles, 100) / 100 - irregularRuns.length,
  }
}

/** Scan every page once. Byte and page limits keep an accidental large upload bounded. */
export async function preparePatternPdfReview(data: ArrayBuffer | Uint8Array, fileName: string, signal?: AbortSignal): Promise<PatternPdfReview> {
  if (signal?.aborted) throw new DOMException('PDF review canceled.', 'AbortError')
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0))
  if (bytes.length > 50 * 1024 * 1024) throw new Error('Pattern PDF exceeds the 50 MB review limit.')
  const loading = getDocument({ data: bytes, disableFontFace: true, useWorkerFetch: false, useSystemFonts: false })
  const abort = () => { void loading.destroy().catch(() => undefined) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const document = await loading.promise
    if (document.numPages > 128) throw new Error('Pattern PDF has more than 128 pages. Split it into a smaller file before importing.')
    const documentName = fileName.replace(/\.pdf$/i, '') || 'Imported pattern'
    const pages: PatternPdfPageReview[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (signal?.aborted) throw new DOMException('PDF review canceled.', 'AbortError')
      try {
        const page = await document.getPage(pageNumber)
        const vector = await readPdfVectorPage(page, document.numPages)
        if (vector.paths.length > 100_000) throw new Error('Page exceeds the 100,000 path review limit.')
        pages.push(reviewPatternPdfPage(vector, documentName))
        page.cleanup()
      } catch (error) {
        if (signal?.aborted) throw new DOMException('PDF review canceled.', 'AbortError')
        pages.push({ pageNumber, page: null, result: null, score: -1, confidence: 'low', issues: [error instanceof Error ? error.message : 'Could not read this page.'] })
      }
    }
    const suggested = [...pages].sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber)[0]
    return { fileName, pages, suggestedPageNumber: suggested?.pageNumber ?? 1 }
  } finally {
    signal?.removeEventListener('abort', abort)
    await loading.destroy()
  }
}
