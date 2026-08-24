import type { StitchPair } from './final-product-types'
import { createDistanceConstraint, type XpbdClothConstraint } from '@atelier/sim'

export type XpbdSeamParticleMap = Map<string, number>

export function buildXpbdSeamDistanceConstraints(params: {
  stitchPairs: StitchPair[]
  particleIndexByHoleId: XpbdSeamParticleMap
  compliance?: number
}) {
  const constraints: XpbdClothConstraint[] = []
  const compliance = params.compliance ?? 1e-8

  for (const pair of params.stitchPairs) {
    const rightHoles = pair.reversed ? [...pair.right.holes].reverse() : pair.right.holes
    const count = Math.min(pair.left.holes.length, rightHoles.length)
    for (let index = 0; index < count; index += 1) {
      const leftIndex = params.particleIndexByHoleId.get(pair.left.holes[index].id)
      const rightIndex = params.particleIndexByHoleId.get(rightHoles[index].id)
      if (leftIndex === undefined || rightIndex === undefined || leftIndex === rightIndex) {
        continue
      }
      constraints.push(createDistanceConstraint({
        a: leftIndex,
        b: rightIndex,
        restLength: 0,
        compliance,
      }))
    }
  }

  return constraints
}
