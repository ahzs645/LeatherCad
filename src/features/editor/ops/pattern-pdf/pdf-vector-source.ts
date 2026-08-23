/**
 * Loads a PDF page as vector geometry.
 *
 * Kept apart from `pdf-vector-paths` so the geometry walk stays a pure function
 * over an operator list: the interesting logic is testable without a PDF, and
 * this file is only the pdf.js plumbing around it.
 */

import { getDocument } from 'pdfjs-dist'

import {
  buildVectorPaths,
  PT_TO_MM,
  type PdfOperatorList,
  type PdfPageBox,
  type PdfVectorPath,
} from './pdf-vector-paths'

export type PdfVectorPage = {
  pageNumber: number
  pageCount: number
  widthMm: number
  heightMm: number
  paths: PdfVectorPath[]
}

/**
 * The slice of pdf.js's `PDFPageProxy` this reader needs.
 *
 * Structural, because the build to import depends on where the code runs: the
 * app pulls the default ESM build, Node scripts need `pdfjs-dist/legacy`, and
 * both hand back the same page object.
 */
export type PdfPageLike = {
  pageNumber: number
  view: number[]
  getOperatorList: () => Promise<PdfOperatorList>
}

/** Reads an already-loaded pdf.js page as painted vector paths in millimetres. */
export async function readPdfVectorPage(
  page: PdfPageLike,
  pageCount: number,
): Promise<PdfVectorPage> {
  const operatorList = await page.getOperatorList()
  const view = page.view as unknown as PdfPageBox
  return {
    pageNumber: page.pageNumber,
    pageCount,
    widthMm: (view[2] - view[0]) * PT_TO_MM,
    heightMm: (view[3] - view[1]) * PT_TO_MM,
    paths: buildVectorPaths(operatorList, view),
  }
}

/**
 * Reads one page of `data` as painted vector paths in millimetres.
 *
 * Fonts are skipped: text is annotation on a pattern sheet, not geometry.
 */
export async function loadPdfVectorPage(
  data: Uint8Array,
  pageNumber = 1,
): Promise<PdfVectorPage> {
  const document = await getDocument({
    data,
    disableFontFace: true,
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise
  try {
    const pageCount = Math.max(1, document.numPages)
    const page = await document.getPage(Math.max(1, Math.min(pageCount, Math.round(pageNumber))))
    return await readPdfVectorPage(page, pageCount)
  } finally {
    await document.destroy()
  }
}
