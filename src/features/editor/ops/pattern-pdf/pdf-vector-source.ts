/**
 * Loads a PDF page as vector geometry.
 *
 * Kept apart from `pdf-vector-paths` so the geometry walk stays a pure function
 * over an operator list: the interesting logic is testable without a PDF, and
 * this file is only the pdf.js plumbing around it.
 */

import { getDocument } from '../pdfjs'

import {
  buildVectorPaths,
  PT_TO_MM,
  type PdfOperatorList,
  type PdfPageBox,
  type PdfTextItem,
  type PdfVectorPath,
} from './pdf-vector-paths'

export type { PdfTextItem }

export type PdfVectorPage = {
  pageNumber: number
  pageCount: number
  widthMm: number
  heightMm: number
  paths: PdfVectorPath[]
  text: PdfTextItem[]
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
  getTextContent: () => Promise<{ items: unknown[] }>
}

/** pdf.js text items, minus the marked-content entries that carry no string. */
type RawTextItem = {
  str: string
  transform: number[]
}

function isTextItem(item: unknown): item is RawTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as RawTextItem).str === 'string' &&
    Array.isArray((item as RawTextItem).transform)
  )
}

/**
 * Reads a page's type, in millimetres from the top-left.
 *
 * The transform pdf.js reports has the text matrix and the CTM already in it,
 * so `e`/`f` are where the baseline starts on the page and the scale of the
 * first column is the rendered font size — no separate matrix walk needed.
 */
function readText(items: unknown[], pageBox: PdfPageBox): PdfTextItem[] {
  const [boxX0, , , boxY1] = pageBox
  const text: PdfTextItem[] = []
  for (const item of items) {
    if (!isTextItem(item)) continue
    if (item.str.trim().length === 0) continue
    const [a, b, , , e, f] = item.transform
    text.push({
      text: item.str,
      position: { x: (e - boxX0) * PT_TO_MM, y: (boxY1 - f) * PT_TO_MM },
      heightMm: Math.hypot(a, b) * PT_TO_MM,
    })
  }
  return text
}

/** Reads an already-loaded pdf.js page as painted vector paths in millimetres. */
export async function readPdfVectorPage(
  page: PdfPageLike,
  pageCount: number,
): Promise<PdfVectorPage> {
  const view = page.view as unknown as PdfPageBox
  const [operatorList, textContent] = await Promise.all([
    page.getOperatorList(),
    page.getTextContent(),
  ])
  return {
    pageNumber: page.pageNumber,
    pageCount,
    widthMm: (view[2] - view[0]) * PT_TO_MM,
    heightMm: (view[3] - view[1]) * PT_TO_MM,
    paths: buildVectorPaths(operatorList, view),
    text: readText(textContent.items, view),
  }
}

/**
 * Reads one page of `data` as painted vector paths and type, in millimetres.
 *
 * Font *faces* are skipped — nothing here rasterises a glyph — but the strings
 * are not: a sheet names its own pieces.
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
