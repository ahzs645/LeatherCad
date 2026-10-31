import { ConvexError } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { parseCommunityProvenance } from '../src/features/editor/ops/community-provenance'

export async function validatePublicationProvenance(
  ctx: MutationCtx, docJson: string, targetLicense: string, ownAttribution: string,
): Promise<string> {
  const doc = JSON.parse(docJson) as { communityProvenance?: unknown }
  let sources
  try { sources = parseCommunityProvenance(doc.communityProvenance) }
  catch { throw new ConvexError('Community source provenance is invalid') }
  const credits = [ownAttribution]
  for (const source of sources) {
    const id = ctx.db.normalizeId('publishedPatterns', source.patternId)
    const pattern = id ? await ctx.db.get(id) : null
    const version = id ? await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', id).eq('version', source.version)).unique() : null
    if (!pattern || !version || version.license !== source.license || version.attribution !== source.attribution
      || version.author !== source.author || version.title !== source.title) {
      throw new ConvexError('A community source reference does not match its published version')
    }
    if (version.license === 'CC-BY-NC-4.0' && targetLicense !== 'CC-BY-NC-4.0') {
      throw new ConvexError('This drawing contains a noncommercial source; keep the CC BY-NC license')
    }
    if (version.license === 'CC-BY-4.0' && targetLicense === 'CC0-1.0') {
      throw new ConvexError('This drawing contains an attributed source; keep an attribution license')
    }
    const credit = `Source: ${version.title}, v${source.version}, by ${version.author} (${version.license}) — ${version.attribution}`
    if (!ownAttribution.includes(credit)) credits.push(credit)
  }
  const attribution = credits.join('\n')
  if (attribution.length > 64_000) throw new ConvexError('Combined source attribution is too long; reduce the source chain')
  return attribution
}
