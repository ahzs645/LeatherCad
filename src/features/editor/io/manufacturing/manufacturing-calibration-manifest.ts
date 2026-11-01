export const PRINTER_FIT_HOLE_DIAMETERS = [1, 1.5, 2, 3, 4, 5] as const
export const PRINTER_FIT_CLEARANCES = [0, 0.05, 0.1, 0.15, 0.2, 0.3] as const
export const PRINTER_FIT_CALIBRATION_MANIFEST = {
  format: 'leathercad-printer-fit-calibration', version: 1, units: 'mm', physicalChecks: 'unperformed',
  orientation: 'View from above with the notched corner at lower left; hole and pocket values increase from left to right.',
  geometryToleranceMm: 0.005,
  plate: { widthMm: 70, heightMm: 60, thicknessMm: 5 },
  measurementBar: { lengthMm: 20, widthMm: 3, riseMm: 1 },
  plug: { widthMm: 8, lengthMm: 10, heightMm: 5 },
  pin: { diameterMm: 3, heightMm: 8 },
  holes: PRINTER_FIT_HOLE_DIAMETERS.map((diameterMm, index) => ({ label: diameterMm.toFixed(1), xMm: 10 + index * 10, yFromNotchedEdgeMm: 51, diameterMm, measuredDiameterMm: null as number | null })),
  pockets: PRINTER_FIT_CLEARANCES.map((clearanceMm, index) => ({ label: clearanceMm.toFixed(2), xMm: 10 + index * 10, yFromNotchedEdgeMm: 30, clearancePerSideMm: clearanceMm, widthMm: 8 + 2 * clearanceMm, lengthMm: 10 + 2 * clearanceMm, depthMm: 3, measuredWidthMm: null as number | null, plugFit: null as 'loose' | 'free' | 'tight' | 'blocked' | null })),
} as const
export type PrinterFitCalibrationManifest = typeof PRINTER_FIT_CALIBRATION_MANIFEST
export const PRINTER_FIT_CALIBRATION_CHECKLIST = `LeatherCad printer fit calibration — millimetres

Physical printing and hardware measurements have NOT been performed for this fixture.
The software verifies geometry, not a particular printer/material combination.

1. Print at 100% scale with the printer, material, nozzle, layer height and orientation intended for the actual pattern or jig. Disable automatic resizing. Keep the plate, rectangular plug and round pin in their supplied orientations.
2. Allow the parts to cool. Place the coupon with its notched corner at lower left. Values increase from left to right.
3. Measure the plate: width 70 mm; height 60 mm; thickness 5 mm.
   Measured width ______ mm; height ______ mm; thickness ______ mm.
4. Measure the raised bar: length 20 mm; width 3 mm; rise above the plate 1 mm.
   Measured length ______ mm; width ______ mm; rise ______ mm.
5. Measure the six through holes: 1.0, 1.5, 2.0, 3.0, 4.0 and 5.0 mm nominal diameter.
   Measured: ______, ______, ______, ______, ______, ______ mm.
   Compare the separate 3 mm pin with the nominal 3 mm hole without forcing it.
6. Measure the separate plug: 8 x 10 x 5 mm. The six pockets are 3 mm deep and add the labelled clearance on EACH side: 0.00, 0.05, 0.10, 0.15, 0.20, 0.30 mm.
   Pocket widths: 8.00, 8.10, 8.20, 8.30, 8.40, 8.60 mm.
   Pocket lengths: 10.00, 10.10, 10.20, 10.30, 10.40, 10.60 mm.
   Smallest freely fitting pocket label ______; observed fit __________________.
7. Use the measured clearance as a starting point for the production jig and repeat after changing printer, material or print settings. Check hole sizing independently; a good XY scale does not establish small-bore fit.

Printer __________________ Material __________________ Date ______________
Nozzle ______ Layer height ______ Scale ______ Other settings ______________
Notes ___________________________________________________________________

The plate, plug and pin are three separate printable parts. Labels are shallow geometric engraving; no external font is required. The STL contains no printer profile or unit metadata: import it as millimetres.
`
