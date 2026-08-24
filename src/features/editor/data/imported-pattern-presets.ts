/**
 * Presets built from a real pattern sheet rather than drawn in code.
 *
 * Every other preset in `sample-doc.ts` is authored here as TypeScript — lines
 * and arcs at coordinates someone typed. This one is the output of
 * `pnpm pattern:pdf` over a published sheet, which is a different kind of
 * sample: its pieces have the outlines a maker actually cut, its stitch runs
 * have the pitch a maker actually punched, and its seams were found by pairing
 * those runs rather than declared. That makes it the one preset that shows what
 * the importer does, and the fastest way to get the 3D assembly on screen
 * without hunting for a file.
 *
 * The document is read from the fixture the import script writes, so there is
 * one copy of it: regenerate the fixture and the shipped sample follows. It
 * arrives as text and goes through `parseImportedJsonDocument`, the same
 * validation the Open command runs, so a fixture that has drifted out of shape
 * fails here rather than halfway through a render.
 */

import walletDocJson from '../../../../docs/fixtures/pattern-pdf/makesupply-keychain-snap-wallet.doc.json?raw'
import type { DocFile } from '../cad/cad-types'
import { parseImportedJsonDocument } from '../editor-json-import'

export type ImportedPatternPreset = {
  id: string
  label: string
  doc: DocFile
}

export const MAKESUPPLY_KEYCHAIN_SNAP_WALLET_ID = 'makesupply-keychain-snap-wallet'

export const IMPORTED_PATTERN_PRESETS: ImportedPatternPreset[] = [
  {
    id: MAKESUPPLY_KEYCHAIN_SNAP_WALLET_ID,
    label: 'Keychain Snap Wallet (imported)',
    doc: parseImportedJsonDocument(walletDocJson).doc,
  },
]
