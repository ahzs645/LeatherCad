import type { ThreeBridge } from '../three/three-bridge'

export function downloadFinalReviewCollage(bridge: ThreeBridge | null) {
  const dataUrl = bridge?.captureFinalProductReviewCollage()
  if (!dataUrl) return

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `leathercad-final-review-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
  link.click()
}
