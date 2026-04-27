# PDFium Browser Parity

Date: 2026-04-27

The extracted LeathercraftCAD desktop app dynamically loads `libpdfium.dylib` and binds many `FPDF_*` APIs. The web app intentionally uses `pdfjs-dist` for browser-safe PDF tracing and preview behavior. This document separates supported browser parity from native-only PDFium depth.

## Browser-Supported Parity

- Import PDF tracing assets through `pdfjs-dist`.
- Select a page for tracing.
- Rasterize the selected page for canvas overlay usage.
- Persist tracing overlay metadata separately from generic image/backdrop state.
- Export generated CAD geometry to PDF through the browser-safe writer in `src/features/editor/io/io-pdf.ts`.
- Include stitch-hole primitives in PDF export using the same native/dot/single-line render options as SVG and DXF.

## Native PDFium Capabilities Out Of Scope For Browser

- Editing existing PDF document structure in place.
- Importing, merging, deleting, or reordering PDF pages inside existing PDFs.
- Saving modified source PDFs with original metadata, object streams, annotations, bookmarks, or signatures preserved.
- Rendering with exact PDFium fidelity for every color profile, font fallback, transparency group, or print-production edge case.
- Accessing local dynamic libraries such as `libpdfium.dylib`.
- Using desktop file dialogs, printer setup dialogs, or native print-driver configuration APIs.

## Implementation Rule

PDF features in the browser app should stay split by role:

- `src/features/editor/ops/tracing-pdf-render.ts`: tracing rasterization and page-preview behavior.
- `src/features/editor/io/io-pdf.ts`: CAD-to-PDF export output.
- UI surfaces: page picking and tracing controls only; no hidden native-PDF mutation state.

If a future desktop wrapper is added, native PDF mutation should live behind an adapter boundary instead of leaking PDFium concepts into shared CAD state.
