import type { AppDataClient } from './app-data-client'
import type { DocFile } from '../cad/cad-types'
import type { PublishedPattern } from './cloud-types'
import { parseImportedJsonDocument } from '../editor-json-import'
import { parseCommunityProvenance } from '../ops/community-provenance'

function canonicalDocument(doc: DocFile) {
  return JSON.stringify(parseImportedJsonDocument(JSON.stringify(doc), { preserveShapeIds: true }).doc)
}

/** Existing remote drawings are never silently overwritten by a bulk upload. */
export async function uploadLocalProjects(local: AppDataClient, remote: AppDataClient) {
  const localProjects = await local.documents.list()
  const result = { uploaded: 0, unchanged: 0, conflicts: [] as string[] }
  for (const project of localProjects) {
    const existing = await remote.documents.get(project.id)
    if (existing) {
      if (canonicalDocument(existing.doc) === canonicalDocument(project.doc)) result.unchanged += 1
      else result.conflicts.push(project.name)
      continue
    }
    await remote.documents.create({ id: project.id, name: project.name, doc: project.doc })
    result.uploaded += 1
  }
  return result
}
export function makeAttributedPatternCopy(pattern: PublishedPattern): DocFile {
  const doc = structuredClone(pattern.doc)
  doc.communityProvenance = parseCommunityProvenance([...(doc.communityProvenance ?? []), {
    kind: 'community-pattern', patternId: pattern.id, version: pattern.version,
    title: pattern.title, author: pattern.author, license: pattern.license, attribution: pattern.attribution,
  }])
  doc.documentName = `${pattern.title} (copy)`
  const attribution = `Source: ${pattern.title}, version ${pattern.version}, by ${pattern.author}\nLicense: ${pattern.license}\nAttribution: ${pattern.attribution}\nCommunity pattern: ${pattern.id}`
  // The normal JSON importer bounds projectMemo to 8000 characters. Put credit
  // first and reserve its space so a long original memo cannot erase attribution.
  doc.projectMemo = [attribution, doc.projectMemo].filter(Boolean).join('\n\n').slice(0, 8000)
  return doc
}
