import type { StitchHole, StitchHoleRenderShape } from '../../cad/cad-types'
import { numberField, type LcadRecord } from './lcad-geometry'

type Blade = { renderShape: StitchHoleRenderShape; width: number; height: number; defaultTilt: number; axisCorrection: number }
function bladeFor(type: unknown): Blade {
  // The native diamond's long axis is X; ours is Y. Native flat blades are
  // perpendicular to X, while our segment representation is horizontal.
  if (type === 'diamond') return { renderShape: 'diamond', width: 0.6, height: 2.2, defaultTilt: -32, axisCorrection: -90 }
  if (type === 'european') return { renderShape: 'french', width: 0.25, height: 2, defaultTilt: -45, axisCorrection: 0 }
  if (type === 'flat') return { renderShape: 'flat', width: 0.3, height: 2, defaultTilt: 0, axisCorrection: 90 }
  return { renderShape: 'round', width: 1.2, height: 1.2, defaultTilt: 0, axisCorrection: 0 }
}

export function importLcadStitchParameters(source: LcadRecord): Pick<StitchHole, 'angleDeg' | 'holeType' | 'renderShape' | 'diameterMm' | 'widthMm' | 'heightMm' | 'tiltDeg' | 'inverted'> {
  const blade = bladeFor(source.stitchType)
  const rawWidth = numberField(source, 'holeW', blade.width), rawHeight = numberField(source, 'holeL', blade.height)
  if (rawWidth < 0 || rawHeight < 0) throw new Error('Invalid .lcad stitch-hole size')
  // Native zero means use the tool default, not a zero-width cut.
  const width = rawWidth > 0 ? rawWidth : blade.width
  const height = rawHeight > 0 ? rawHeight : blade.height
  const customTilt = source.holeTilt == null || source.holeTilt === '' ? undefined : numberField(source, 'holeTilt')
  if (customTilt !== undefined && (customTilt < 0 || customTilt > 90)) throw new Error('Invalid .lcad holeTilt: expected 0–90 degrees')
  return {
    angleDeg: (numberField(source, 'angle', 0) * 180) / Math.PI + blade.axisCorrection,
    holeType: blade.renderShape === 'round' ? 'round' : 'slit', renderShape: blade.renderShape,
    diameterMm: blade.renderShape === 'round' ? width : undefined, widthMm: width,
    heightMm: blade.renderShape === 'round' ? width : height,
    tiltDeg: blade.defaultTilt === 0 ? 0 : -(customTilt ?? Math.abs(blade.defaultTilt)),
    inverted: source.inverted === true,
  }
}

export function exportLcadStitchParameters(hole: StitchHole): LcadRecord {
  const stitchType = hole.renderShape === 'french' ? 'european' : hole.renderShape === 'diamond' ? 'diamond' : hole.renderShape === 'flat' || hole.renderShape === 'slit' || hole.holeType === 'slit' ? 'flat' : 'round'
  const blade = bladeFor(stitchType)
  if (stitchType !== 'round' && hole.widthMm === 0) throw new Error('LCAD cannot represent a zero-width stitch blade. Use Document JSON or SVG to preserve this drawing.')
  const effectiveTilt = (hole.inverted ? -1 : 1) * (hole.tiltDeg ?? 0)
  let angleDeg = hole.angleDeg - blade.axisCorrection
  const magnitude = Math.abs(effectiveTilt)
  const nativeTilt = blade.defaultTilt !== 0 && magnitude <= 90
  // A flat native blade cannot carry tilt; fold it into its base rotation.
  if (!nativeTilt && stitchType !== 'round') angleDeg += effectiveTilt
  return {
    stitchType, angle: (angleDeg * Math.PI) / 180,
    holeW: hole.widthMm ?? hole.diameterMm ?? blade.width,
    holeL: hole.heightMm ?? hole.diameterMm ?? blade.height,
    ...(nativeTilt ? { holeTilt: magnitude, inverted: effectiveTilt > 0 } : {}),
  }
}
