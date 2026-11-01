# Sealed LCC read compatibility

LeatherCad can read the observed **sealed v1 / zlib+base64** container with inner **LeathercraftCAD 4.2.0** drawings. The drawing importer verifies the format MAC before inflating or interpreting artwork, then opens **Review drawing import**. Cancel or any failure leaves the open drawing intact. The notice artwork outside `sealed.data` is never substituted for the real drawing.

This is a bounded, independently written compatibility reader. It is not a general claim that every `.lcc`, application version or licensed component is supported. Sealed output is not implemented. Use Document JSON to retain a complete LeatherCad project.

## Observed protocol

1. The outer JSON has `meta.file_type: "LeathercraftCAD_Sealed"`, `meta.min_reader`, and `sealed: { ver, enc, data, mac }`.
2. Only numeric `ver: 1` and `enc: "zlib+base64"` are accepted. `min_reader` must be a three-part numeric version no newer than **4.2.0**. The producer's web-build label is informational.
3. `mac` is 64 hexadecimal characters, with source-compatible case/outer-whitespace handling. HMAC-SHA-256 authenticates the **UTF-8 bytes of the literal `sealed.data` string**, before removing base64 whitespace. It does not authenticate the decoded compressed bytes or the remaining outer metadata.
4. After a successful MAC check, base64 whitespace is removed and the bytes are decompressed as a complete **zlib-wrapped deflate** stream. Gzip/raw deflate, truncation, checksum failures, invalid UTF-8 and malformed JSON reject.
5. The inner object must have `meta.file_type: "LeathercraftCAD"`, `meta.version: "4.2.0"`, and valid layers/shapes. Numeric values, IDs/references, geometry, resources and group hierarchy are validated before the resulting document can be applied. A valid MAC never bypasses document validation.

The global v1 HMAC parameter is shipped with the reference reader. It establishes **format compatibility and accidental/tamper integrity**, not authorship, licensing, ownership or trusted provenance. It is not an account/service credential. The browser imports it as a nonextractable Web Crypto key with `verify` usage only; this application provides no seal-generation API. Outer version/encoding/minimum-reader checks are separate because those fields are outside MAC coverage.

## Supported content and explicit limits

| Content | Treatment |
| --- | --- |
| Lines, explicit cubic controls, circular arcs and ellipse parameters | Existing LCC conversion preserves supported exact primitives. A path-only fallback follows the normal legacy path reader and its warnings. |
| Source layers and stitch chains | Layers retain names/visibility; numeric layer references normalize consistently. Shape IDs and stitch-link IDs must be strings in this known schema. Layer positions do not imply fold/cut/stitch roles in v4.2; multilayer files request role review. |
| Width, shape opacity, nested groups, memo | Retained where the editor model supports them. A memo over 8,000 characters truncates with a review warning. Cross-layer legacy group membership has an explicit warning. |
| Embedded tracing | PNG/JPEG/WebP base64 assets, pixel and physical sizes, position, rotation, DPI, visibility and opacity are retained. Path-only image references require re-import and warn. |
| Native linear `DIMENSION` | Endpoints, offset, label, font size, precision and supported presentation flags map to a detached dimension annotation. Review warns that source associations are not live links; source label text represents unit overrides. |
| Radius/unknown `DIMENSION`, unknown shape types or inner versions | Explicit rejection; no silent geometry substitution. |
| Licensed-part provenance (`meta.licenses` or shape `orig`) | Explicit rejection because this reader cannot yet preserve that provenance contract. A valid MAC does not grant permission or strip attribution. |
| Outer compatibility artwork | Ignored; it is not the drawing. |

Both serialized input and inflated payload are limited to **50 MiB** independently. Conversion also enforces **200,000** expanded geometry records, **2,000** layers, **20 MiB** aggregate embedded images, nesting depth **64**, and **2 million** parsed tree nodes. These are admission limits, not performance guarantees for every document below them.

Legacy dimension reconstruction has an additional **2,048 candidate primitives** limit before its superlinear matching work. This counts only LINE/TEXT records marked as dimension components; ordinary cut/stitch LINEs are unaffected. Re-save such a file as native `DIMENSION` records or LCAD in the source application. Native linear dimension records bypass that reconstruction.

Browser reads run in the disposable drawing worker. Canceling/replacing a session terminates it. The async decoding API additionally checks `AbortSignal` around verification and inflation, and bounds decompression while reading chunks. Direct synchronous `importLccDocument` and repository-ZIP entry conversion do not verify sealed containers: open the individual sealed file through the drawing importer. Unsupported runtimes without Web Crypto or zlib `DecompressionStream` report an error.

## Provenance and evidence

The format was observed in the user-supplied Coffee Craft CAD web snapshot dated **2026-10-27**, script `app-affc2f74a7.js`, SHA-256 `b5830eaade610a428de0776d1989361fc7ddfae9fc2f48e0833f67551af586a1`. The independent implementation uses standard Web Crypto and browser decompression APIs, with the observed global format parameter as compatibility data. The captured application implementation, HAR, account/session responses, user artwork and tokens are not included in this repository.

The [official application page](https://coffee-craft.net/en/leathercraft_cad) and [v4.2.0 release](https://github.com/LuthierLeather/leathercraft-cad-releases/releases/tag/v4.2.0) confirm the current release and web-file opening behavior. The linked release repository provides downloads; the materials consulted did not publish a sealed protocol/verifier specification. This reader therefore claims the tested observed subset, rather than a broader official contract.

The sole original-runtime-produced fixture checked in here is our own **24 × 16 mm four-edge rectangle**, with [provenance and digest](fixtures/interchange/README.md). It verifies with the default reader and yields four lines rather than the outer notice TEXT. In an anonymous, network-isolated replay of the source runtime, the same file opened as four shapes and converted to four LCAD lines. Changing MAC or data produced the source application's broken-seal error while retaining the open document. [Sanitized evidence](verification/sealed-lcc-compatibility.json) contains only protocol facts and our synthetic results.

Run read-only protocol diagnostics from the repository root:

```sh
node scripts/inspect-sealed-lcc.mjs docs/fixtures/interchange/reference-sealed-rectangle.lcc
pnpm exec vitest run src/features/editor/io/io-lcc-sealed.test.ts
```

The diagnostic prints only metadata/counts and an input digest, never decoded artwork or a loadable document. It verifies by default; `--unverified` is an explicit forensic inspection mode and always reports `trustedForImport: false`. The application importer has no such bypass. Unit tests sign only locally owned synthetic payloads with a separate test key. Production-browser acceptance uses the genuine reference fixture, real Worker/Web Crypto/decompression, staged cancel/apply and corruption preservation.
