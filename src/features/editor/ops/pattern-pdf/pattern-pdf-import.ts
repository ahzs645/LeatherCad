/**
 * Opening a pattern PDF from the editor.
 *
 * The stages either side of this one are deliberately environment-free — the
 * reader takes a page object, the analysis takes paths — which leaves the
 * browser's share of the work here: configure pdf.js's worker, run the four
 * stages, and say in one line what came off the sheet, because "imported"
 * tells a user nothing about whether the import understood their template.
 */

import './../pdf-worker'

import type { DocFile } from '../../cad/cad-types'
import { assemblePatternDoc } from './pattern-assembly-placement'
import { buildPatternDoc, type PatternDocBuildOptions } from './pattern-doc-builder'
import { analyzePatternPaths, type PatternPdfAnalysis } from './pattern-pdf-analysis'
import { loadPdfVectorPage } from './pdf-vector-source'

export type PatternPdfImportOptions = {
  /** 1-based page to read. Sheets past the first are usually instructions. */
  pageNumber: number
  /** Name for the imported project. Defaults to the analysis's own wording. */
  documentName?: string
  /**
   * Dihedral angle the pieces are placed at, in degrees. 180 lays a lining onto
   * its panel, which is what most sheets are drawn as.
   */
  assemblyAngleDeg: number
  build?: Partial<PatternDocBuildOptions>
}

export const DEFAULT_PATTERN_PDF_IMPORT_OPTIONS: PatternPdfImportOptions = {
  pageNumber: 1,
  assemblyAngleDeg: 180,
}

export type PatternPdfImport = {
  doc: DocFile
  analysis: PatternPdfAnalysis
  pageNumber: number
  pageCount: number
  /** One line for the status bar. */
  summary: string
  /** Everything the import could not resolve, in the user's words. */
  warnings: string[]
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * The one-line account of what came off the sheet.
 *
 * Written to be read by someone holding the paper template: piece count, the
 * pitch they will punch at, and how many runs were paired — the three things
 * that say whether the import understood the pattern.
 */
export function describePatternImport(analysis: PatternPdfAnalysis, warningCount: number) {
  const parts = [plural(analysis.pieces.length, 'piece')]
  if (analysis.stitching.totalHoles > 0) {
    parts.push(
      `${plural(analysis.stitching.totalHoles, 'stitch hole')} at ` +
        `${analysis.stitching.pitchMm.toFixed(2)} mm (${analysis.stitching.stitchesPerInch.toFixed(1)} SPI)`,
    )
  }
  const seams = analysis.seams.filter((seam) => !seam.fold).length
  const folds = analysis.seams.filter((seam) => seam.fold).length
  if (seams > 0) parts.push(plural(seams, 'seam'))
  if (folds > 0) parts.push(`${plural(folds, 'folded piece')}`)
  if (warningCount > 0) parts.push(plural(warningCount, 'warning'))
  return parts.join(' · ')
}

/**
 * Reads a pattern PDF into a project, with the pieces already placed.
 *
 * Placement happens here rather than being left to the user because an import
 * that opens as a flat net looks like it failed, and the seams already say
 * where every piece goes.
 */
export async function importPatternPdf(
  data: Uint8Array,
  options: Partial<PatternPdfImportOptions> = {},
): Promise<PatternPdfImport> {
  const config = { ...DEFAULT_PATTERN_PDF_IMPORT_OPTIONS, ...options }
  const page = await loadPdfVectorPage(data, config.pageNumber)
  const analysis = analyzePatternPaths(
    page.paths,
    { widthMm: page.widthMm, heightMm: page.heightMm },
    {},
    page.text,
  )
  const built = buildPatternDoc(analysis, {
    ...config.build,
    ...(config.documentName ? { documentName: config.documentName } : {}),
  })
  const assembled = assemblePatternDoc(built.doc, config.assemblyAngleDeg)

  const warnings = [...built.warnings]
  for (const seamId of assembled.placement.skippedSeamIds) {
    warnings.push(`${seamId}: the seam could not be resolved against the geometry`)
  }
  if (analysis.pieces.length === 0) {
    warnings.push('No closed outline on this page was large enough to be a pattern piece')
  }

  return {
    doc: assembled.doc,
    analysis,
    pageNumber: page.pageNumber,
    pageCount: page.pageCount,
    summary: describePatternImport(analysis, warnings.length),
    warnings,
  }
}
