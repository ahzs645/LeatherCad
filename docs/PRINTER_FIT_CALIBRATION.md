# Printer fit gauge

The STL dialog offers **Printer fit calibration** with separate gauge and measurement-checklist downloads. These actions preserve the current drawing. Gauge generation runs in a cancellable worker; the checklist remains available even if workers are unavailable.

The fixture is authored geometry with three separate printable parts:

- A notched 70 × 60 × 5 mm plate and a 20 × 3 mm bar raised 1 mm above it.
- Six through holes of nominal diameter 1.0, 1.5, 2.0, 3.0, 4.0 and 5.0 mm.
- Six pockets 3 mm deep, fitting the separate 8 × 10 × 5 mm plug with 0.00, 0.05, 0.10, 0.15, 0.20 and 0.30 mm clearance on each side.
- A separate 3 mm diameter, 8 mm high pin for comparing small-bore fit.

Numeric labels are shallow geometric engraving and require no font file. Pocket clearance is per side: the 0.20 label means a pocket 8.40 × 10.40 mm. With the notched corner at lower left, hole and pocket values increase from left to right.

To regenerate the same files locally:

```sh
pnpm calibration:stl --out-dir /path/to/printer-fit-calibration
```

The default destination is `artifacts/printer-fit-calibration/`. The generator writes an ASCII STL, `measurements.json` with empty measurement fields and `CHECKLIST.txt`. The JSON explicitly records `physicalChecks: "unperformed"`.

Print at 100% scale in millimetres using the intended printer, material, nozzle and layer height. After cooling, measure the plate, raised bar and holes, then record the smallest pocket in which the plug fits freely. Keep XY scale, bore sizing and fit clearance as separate measurements. Repeat when printer/material/settings change.

Unit checks measure actual mesh sections to verify hole diameters, pocket widths/lengths, retained floors and the raised bar. An independent [trimesh reread](verification/manufacturing-combined-mesh-2026-11-01.json) finds three closed, consistently oriented positive-volume components, overall bounds of 88 × 60 × 8 mm, and the expected horizontal contour counts through bores, pockets, bar and pin. **Physical printing and measurements have not been performed.** The fixture does not certify a printer profile or guarantee a production fit.
