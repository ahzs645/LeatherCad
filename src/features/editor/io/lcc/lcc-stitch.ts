import type { StitchHole } from '../../cad/cad-types'

export function rebuildStitchSequences(
  stitchHoles: StitchHole[],
  idMap: Map<string, string>,
  nextMap: Map<string, string>,
) {
  if (stitchHoles.length === 0) return

  const holeById = new Map(stitchHoles.map((h) => [h.id, h]))
  const referencedAsNext = new Set(nextMap.values())
  const lccIds = [...idMap.keys()]
  const chainStarts = lccIds.filter((lccId) => !referencedAsNext.has(lccId))

  if (chainStarts.length === 0) {
    stitchHoles.forEach((h, i) => {
      h.sequence = i
      h.chainId = `lcc-stitch-chain-${i + 1}`
    })
    return
  }

  let globalSeq = 0
  let chainIndex = 0
  const visited = new Set<string>()

  for (const startLccId of chainStarts) {
    const chainId = `lcc-stitch-chain-${chainIndex + 1}`
    let chainSeq = 0
    let current: string | undefined = startLccId
    while (current && !visited.has(current)) {
      visited.add(current)
      const ourId = idMap.get(current)
      if (ourId) {
        const hole = holeById.get(ourId)
        if (hole) {
          hole.sequence = globalSeq++
          hole.chainId = chainId
          chainSeq++
        }
      }
      current = nextMap.get(current)
    }
    if (chainSeq > 0) {
      chainIndex++
    }
  }

  for (const lccId of lccIds) {
    if (visited.has(lccId)) continue
    const ourId = idMap.get(lccId)
    if (ourId) {
      const hole = holeById.get(ourId)
      if (hole) {
        hole.sequence = globalSeq++
        hole.chainId = `lcc-stitch-chain-${chainIndex + 1}`
        chainIndex++
      }
    }
  }
}
