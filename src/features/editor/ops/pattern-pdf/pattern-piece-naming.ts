/**
 * Names pieces from the words printed on them.
 *
 * A template sheet labels its own pieces, and "MAIN BODY PANEL" beats
 * "Piece A — 107.9 × 128.5 mm" as a name by a distance nothing else can make
 * up. The difficulty is that the label is not the only type sitting on a piece:
 * the maker's name and the pattern's title are printed on each one too, and so
 * are its dimensions.
 *
 * Two rules separate the name from the furniture:
 *
 * - A line printed on more than one piece is not any piece's name. Titles and
 *   maker's marks repeat; "CARD SLOT PANEL" does not.
 * - A line that is only a measurement is a dimension, not a name.
 *
 * What survives is joined in reading order, which is how a two-line label like
 * "KEYCHAIN" / "ATTACHMENT" comes back whole.
 */

import type { PdfTextItem } from './pdf-vector-paths'

/** Anything that is only digits, separators, and unit marks. */
const MEASUREMENT = /^[\s\d.,/×xX*+-]*(?:mm|cm|m|in|"|”|″|'|′)?[\s\d.,/×xX*+-]*(?:mm|cm|m|in|"|”|″|'|′)?[\s.]*$/

export function looksLikeMeasurement(line: string) {
  const trimmed = line.trim()
  return trimmed.length > 0 && /\d/.test(trimmed) && MEASUREMENT.test(trimmed)
}

function normalise(line: string) {
  return line.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Labels top to bottom, then left to right — the order they are read in. */
function inReadingOrder(labels: PdfTextItem[]) {
  return [...labels].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
}

/**
 * A name per piece, for the pieces whose labels yield one.
 *
 * Pieces with no label of their own are absent from the result rather than
 * given a generated name: what to fall back to is the caller's decision.
 */
export function namePiecesFromLabels(
  labelsByPieceId: Map<string, PdfTextItem[]>,
): Map<string, string> {
  const pieceCount = new Map<string, number>()
  for (const labels of labelsByPieceId.values()) {
    for (const line of new Set(labels.map((label) => normalise(label.text)))) {
      pieceCount.set(line, (pieceCount.get(line) ?? 0) + 1)
    }
  }

  const names = new Map<string, string>()
  for (const [pieceId, labels] of labelsByPieceId) {
    const kept = inReadingOrder(labels)
      .filter((label) => (pieceCount.get(normalise(label.text)) ?? 0) <= 1)
      .filter((label) => !looksLikeMeasurement(label.text))
      .map((label) => label.text.trim())
    const name = kept.join(' ').replace(/\s+/g, ' ').trim()
    if (name.length > 0) names.set(pieceId, name)
  }
  return names
}
