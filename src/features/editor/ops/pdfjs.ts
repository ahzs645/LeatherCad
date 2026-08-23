/**
 * The pdf.js build this app talks to.
 *
 * pdf.js ships two: the default one targets browsers that have shipped every
 * feature it uses, and `legacy/` carries the polyfills for the ones that have
 * not. That sounds like a choice about supporting old browsers, and it is not —
 * the default build calls `Map.prototype.getOrInsertComputed`, a proposal
 * method no released browser has, so `getOperatorList` (and therefore every
 * page render) throws `getOrInsertComputed is not a function` on current
 * Chrome. The legacy build polyfills it.
 *
 * One module decides this so the app cannot end up with two copies of pdf.js in
 * the bundle, each with its own worker and its own global state.
 */

export {
  getDocument,
  GlobalWorkerOptions,
  OPS,
  Util,
  PixelsPerInch,
  version,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
