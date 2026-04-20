export type FrustumInput = {
  topRadius: number
  bottomRadius: number
  height: number
}

export type FrustumUnroll = {
  topRadius: number
  bottomRadius: number
  height: number
  slantHeight: number
  innerRadius: number
  outerRadius: number
  sectorAngleRad: number
  sectorAngleDeg: number
  outerArcLength: number
  innerArcLength: number
}

/**
 * Unroll a truncated cone (frustum) side wall onto a flat annular sector.
 * Returns null for the degenerate cylinder case (topRadius ≈ bottomRadius),
 * which the caller should handle separately with a rectangular panel.
 *
 * Mirrors the Delphi TFrustumPatternP record from the source app.
 */
export function computeFrustumUnroll(input: FrustumInput): FrustumUnroll | null {
  const { topRadius, bottomRadius, height } = input
  const radiusDelta = Math.abs(bottomRadius - topRadius)
  if (radiusDelta < 1e-6) {
    return null
  }
  const slantHeight = Math.hypot(height, bottomRadius - topRadius)
  const smallerRadius = Math.min(topRadius, bottomRadius)
  const largerRadius = Math.max(topRadius, bottomRadius)
  const innerRadius = (slantHeight * smallerRadius) / radiusDelta
  const outerRadius = innerRadius + slantHeight
  const sectorAngleRad = (2 * Math.PI * largerRadius) / outerRadius
  return {
    topRadius,
    bottomRadius,
    height,
    slantHeight,
    innerRadius,
    outerRadius,
    sectorAngleRad,
    sectorAngleDeg: (sectorAngleRad * 180) / Math.PI,
    outerArcLength: outerRadius * sectorAngleRad,
    innerArcLength: innerRadius * sectorAngleRad,
  }
}
