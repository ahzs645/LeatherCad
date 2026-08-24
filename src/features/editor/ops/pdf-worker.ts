/**
 * Points pdf.js at its worker bundle.
 *
 * pdf.js parses on a worker thread and refuses to guess where that script
 * lives; without this it falls back to parsing on the main thread, which locks
 * the UI for as long as a page takes. Importing this module configures it, so
 * anything that opens a PDF in the browser imports it first.
 *
 * Browser only — the `?url` import is Vite's. Node callers need no worker.
 * The worker has to come from the same build as the main thread, so this
 * follows `./pdfjs` to the legacy one.
 */

import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import { GlobalWorkerOptions } from './pdfjs'

if (GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

export { pdfWorkerUrl }
