import type { CommunityPatternProvenance } from '../cad/cad-types'

export function parseCommunityProvenance(value: unknown): CommunityPatternProvenance[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 32) throw new Error('Community provenance must contain at most 32 sources')
  const sources: CommunityPatternProvenance[] = []
  const seen = new Set<string>()
  for (const candidate of value as unknown[]) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Community provenance is invalid')
    const source = candidate as Record<string, unknown>
    if (source.kind !== 'community-pattern' || typeof source.patternId !== 'string' || !source.patternId || source.patternId.length > 200
      || typeof source.version !== 'number' || !Number.isSafeInteger(source.version) || source.version < 1
      || typeof source.title !== 'string' || !source.title || source.title.length > 200
      || typeof source.author !== 'string' || !source.author || source.author.length > 200
      || typeof source.attribution !== 'string' || !source.attribution || source.attribution.length > 64_000
      || (source.license !== 'CC0-1.0' && source.license !== 'CC-BY-4.0' && source.license !== 'CC-BY-NC-4.0')) {
      throw new Error('Community provenance is invalid')
    }
    const key = `${source.patternId}@${source.version}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({ kind: 'community-pattern', patternId: source.patternId, version: source.version, title: source.title, author: source.author, license: source.license, attribution: source.attribution })
  }
  return sources
}
