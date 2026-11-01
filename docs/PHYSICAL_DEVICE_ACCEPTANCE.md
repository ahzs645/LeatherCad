# Paper, printer and device acceptance

The automated checks verify digital dimensions and browser behavior. Record the physical measurements below for the actual printer, driver, paper, slicer, material and device being used. A successful PDF or mesh check is not a measured print.

## Paper calibration kit

The [calibration kit](fixtures/physical-calibration/manifest.json) contains synthetic editable JSON drawings, printable HTML and PDFs for A4 and US Letter:

- [100 mm XY sheet, A4](fixtures/physical-calibration/xy-100mm-a4.pdf) and [Letter](fixtures/physical-calibration/xy-100mm-letter.pdf): measure the small square's bottom and right sides, then 10 intervals of the 4 mm pitch marks (40 mm total). The diagonal marker identifies its lower-right corner; the larger rectangle is the page boundary.
- [Asymmetric tiled panel, A4](fixtures/physical-calibration/asymmetric-tiled-a4.pdf) and [Letter](fixtures/physical-calibration/asymmetric-tiled-letter.pdf): two pages, 300 × 180 mm, a 20 mm notch at the upper-right, and 10 mm shared overlap. Trim the page margins and align the repeated horizontal line and pitch marks; check dimensions across the join.

Print at **actual size / 100%**, select matching paper, disable fit/shrink/driver scaling and headers/footers, and use the same orientation and driver settings for production. Measure between line centers. Use a ruler or caliper with appropriate resolution; record the instrument and an acceptance tolerance suited to the intended work before measuring.

The DPI readout describes the browser calibration factor; it is not a measurement of printer resolution.

If the XY sheet is wrong, calculate a first correction separately for each axis:

```
new calibration percent = current calibration percent × 100 / measured length in mm
```

For example, a 99.5 mm X measurement at 100% suggests 100.503% X. Reprint and measure again. Landscape output exchanges the portrait X/Y calibration axes. Keep orientation and driver settings with the calibration record. A correction for paper output does not calibrate a 3D printer.

Regenerate with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium pnpm calibration:print`. Playwright's downloaded Chromium works without that variable. Independently check generated PDF geometry with `python scripts/verify-print-calibration.py` after installing `pypdf` in a suitable Python environment. The kit is generated from LeatherCad's real print planner/output code. Its manifest deliberately records `physicalPrinterChecked: false` until an actual test is reported. Chromium can round PDF page extents by a fraction of a millimeter; the validator measures artwork paths independently.

The print planner now uses paper dimensions, margins and requested scale directly. Small drawings retain their millimeter size, every tile uses the same scale, and each join repeats the requested overlap. US Letter is 215.9 × 279.4 mm. If the drawing exceeds the chosen number of pages, print preview reports clipping; increase the tile count.

## Record a physical result

Copy this block for each setup. Do not replace pending fields with automated results.

```
Date / operator:
Printer / driver / OS:
Paper / orientation / driver scaling:
Instrument / stated tolerance:
Calibration X% / Y%:
Measured X100 / Y100 / ten pitch intervals:
Tiled overall width / height / notch / overlap alignment:
Result and remaining error:
```

For STL fit, use the [printer fit gauge](PRINTER_FIT_CALIBRATION.md) and record slicer/version, units, scale, orientation, nozzle/resin process, layer height, shrink/elephant-foot compensation, material and measured fit. Inspect every exported model in the intended slicer before production. Measurements and desired clearances are process-specific.

## Browser engine and real-device checks

`pnpm test:webkit` runs Playwright WebKit on Linux with desktop Safari and iPhone viewport/touch descriptors. Install the browser and OS libraries with `pnpm exec playwright install --with-deps webkit` on a machine where OS package installation is available. This adds a second browser engine to the Chromium gate. It does not run Safari on an iPhone or establish iOS download, storage eviction or GPU behavior.

On each real Safari/iOS device, record model, OS/browser version and app revision, then check:

1. Open an editable drawing, make a change, background/reload the app, and recover the saved draft. Download a backup before discarding it. Repeat with low storage or private browsing if that mode is supported for the workflow; failures must remain visible.
2. Import LCAD/DXF through review; cancel once and accept once. Check that cancellation preserves the drawing and that the Files picker/download destination is usable.
3. Open Options with touch, scroll/search, edit a numeric value, close it, and reopen after reload. Check labels, keyboard obstruction and 44 px targets.
4. Save JSON and download PDF/STL to Files, reopen the JSON, and inspect the other files using the intended downstream app. Check a font-containing manufacturing document if engraving is used.
5. Open 3D and Split directly, rotate/zoom, return to 2D, background/foreground and revisit. Record WebGL context loss or memory pressure behavior rather than treating desktop software rendering as equivalent.
6. When cloud is configured, complete real sign-in/callback and expiry flows with an unsaved drawing and two independent accounts; use the cloud deployment runbook and smoke tooling.

No physical printer or real Safari/iOS device is attached to this execution environment. Those acceptance results remain pending.
