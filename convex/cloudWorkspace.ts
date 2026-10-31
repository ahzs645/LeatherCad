import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { ownerMutation, ownerQuery } from './authenticated'
import { recordDocumentRevision } from './cloudWorkspaceHistory'
import { nullableFolderId, workspaceDocument, workspaceFolder, workspaceRevision } from './cloudWorkspaceSchema'
import { boundedText, cursor, remoteDocument, validateDocumentJson } from './validators'

type ReadCtx = QueryCtx | MutationCtx
const pageOf = <T extends Parameters<typeof v.array>[0]>(item: T) => v.object({ page: v.array(item), continueCursor: v.string(), isDone: v.boolean() })
const emptyPage = () => ({ page: [], continueCursor: '', isDone: true })

function requireRevision(actual: number | null, expected: number | null, label: string) {
  if ((expected !== null && (!Number.isSafeInteger(expected) || expected < 1)) || actual !== expected) {
    throw new ConvexError(`${label} changed; refresh before trying again`)
  }
}
function folderView(row: Doc<'cloudFolders'>) {
  return { id: row._id, name: row.name, parentId: row.parentId, revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt }
}
async function folder(ctx: ReadCtx, owner: string, id: Id<'cloudFolders'>) {
  const row = await ctx.db.get(id)
  if (!row || row.owner !== owner) throw new ConvexError('Folder is not available')
  return row
}
async function documentRow(ctx: ReadCtx, owner: string, id: string) {
  return ctx.db.query('cloudDocuments').withIndex('by_owner_and_clientId', q => q.eq('owner', owner).eq('clientId', id)).unique()
}
async function locationRow(ctx: ReadCtx, owner: string, documentId: Id<'cloudDocuments'>) {
  return ctx.db.query('cloudDocumentLocations').withIndex('by_owner_and_documentId', q => q.eq('owner', owner).eq('documentId', documentId)).unique()
}
async function ensureParent(ctx: ReadCtx, owner: string, parentId: Id<'cloudFolders'> | null, movingId?: Id<'cloudFolders'>) {
  let next = parentId
  const visited = new Set<string>()
  while (next !== null) {
    if (next === movingId || visited.has(next)) throw new ConvexError('A folder cannot be moved into itself or its descendants')
    if (visited.size >= 31) throw new ConvexError('Folder nesting is limited to 32 levels')
    visited.add(next)
    next = (await folder(ctx, owner, next)).parentId
  }
  return visited.size
}
async function ensureSubtreeFits(ctx: ReadCtx, owner: string, root: Id<'cloudFolders'>, maximumDepth: number) {
  const queue = [{ id: root, depth: 1 }], visited = new Set<string>()
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index]
    if (item.depth > maximumDepth) throw new ConvexError('This move would exceed the 32-level folder nesting limit')
    if (visited.has(item.id)) throw new ConvexError('The folder tree contains a cycle')
    visited.add(item.id)
    const children = await ctx.db.query('cloudFolders').withIndex('by_owner_and_parentId', q => q.eq('owner', owner).eq('parentId', item.id))
      .take(1_001 - queue.length)
    if (queue.length + children.length > 1_000) throw new ConvexError('Move child folders separately; this tree is too large to move in one operation')
    queue.push(...children.map(child => ({ id: child._id, depth: item.depth + 1 })))
  }
}
async function ensureNameAvailable(ctx: ReadCtx, owner: string, parentId: Id<'cloudFolders'> | null, name: string, except?: Id<'cloudFolders'>) {
  const found = await ctx.db.query('cloudFolders')
    .withIndex('by_owner_and_parentId_and_nameKey', q => q.eq('owner', owner).eq('parentId', parentId).eq('nameKey', name.toLowerCase()))
    .unique()
  if (found && found._id !== except) throw new ConvexError('A folder with that name already exists here')
}

export const listFolders = ownerQuery({
  args: { parentId: nullableFolderId, cursor }, returns: pageOf(workspaceFolder),
  handler: async (ctx, args) => {
    if (args.parentId) await folder(ctx, ctx.owner, args.parentId)
    const result = await ctx.db.query('cloudFolders').withIndex('by_owner_and_parentId', q => q.eq('owner', ctx.owner).eq('parentId', args.parentId))
      .paginate({ numItems: 25, cursor: args.cursor })
    return { page: result.page.map(folderView), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const getFolder = ownerQuery({
  args: { id: v.id('cloudFolders') }, returns: v.union(workspaceFolder, v.null()),
  handler: async (ctx, args) => { const row = await ctx.db.get(args.id); return row?.owner === ctx.owner ? folderView(row) : null },
})
export const listAllFolders = ownerQuery({
  args: { cursor }, returns: pageOf(workspaceFolder),
  handler: async (ctx, args) => {
    const result = await ctx.db.query('cloudFolders').withIndex('by_owner_and_parentId', q => q.eq('owner', ctx.owner))
      .paginate({ numItems: 25, cursor: args.cursor })
    return { page: result.page.map(folderView), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const createFolder = ownerMutation({
  args: { name: v.string(), parentId: nullableFolderId }, returns: workspaceFolder,
  handler: async (ctx, args) => {
    const name = boundedText(args.name, 'Folder name', 120)
    await ensureParent(ctx, ctx.owner, args.parentId)
    await ensureNameAvailable(ctx, ctx.owner, args.parentId, name)
    const now = Date.now()
    const row = { owner: ctx.owner, name, nameKey: name.toLowerCase(), parentId: args.parentId, revision: 1, createdAt: now, updatedAt: now }
    const id = await ctx.db.insert('cloudFolders', row)
    return { id, name, parentId: args.parentId, revision: 1, createdAt: now, updatedAt: now }
  },
})
export const renameFolder = ownerMutation({
  args: { id: v.id('cloudFolders'), name: v.string(), expectedRevision: v.number() }, returns: workspaceFolder,
  handler: async (ctx, args) => {
    const row = await folder(ctx, ctx.owner, args.id), name = boundedText(args.name, 'Folder name', 120)
    requireRevision(row.revision, args.expectedRevision, 'Folder')
    await ensureNameAvailable(ctx, ctx.owner, row.parentId, name, row._id)
    const update = { name, nameKey: name.toLowerCase(), revision: row.revision + 1, updatedAt: Date.now() }
    await ctx.db.patch(row._id, update)
    return folderView({ ...row, ...update })
  },
})
export const moveFolder = ownerMutation({
  args: { id: v.id('cloudFolders'), parentId: nullableFolderId, expectedRevision: v.number() }, returns: workspaceFolder,
  handler: async (ctx, args) => {
    const row = await folder(ctx, ctx.owner, args.id)
    requireRevision(row.revision, args.expectedRevision, 'Folder')
    const parentDepth = await ensureParent(ctx, ctx.owner, args.parentId, row._id)
    await ensureSubtreeFits(ctx, ctx.owner, row._id, 32 - parentDepth)
    await ensureNameAvailable(ctx, ctx.owner, args.parentId, row.name, row._id)
    const update = { parentId: args.parentId, revision: row.revision + 1, updatedAt: Date.now() }
    await ctx.db.patch(row._id, update)
    return folderView({ ...row, ...update })
  },
})
export const removeFolder = ownerMutation({
  args: { id: v.id('cloudFolders'), expectedRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await folder(ctx, ctx.owner, args.id)
    requireRevision(row.revision, args.expectedRevision, 'Folder')
    const [children, documents] = await Promise.all([
      ctx.db.query('cloudFolders').withIndex('by_owner_and_parentId', q => q.eq('owner', ctx.owner).eq('parentId', row._id)).take(1),
      ctx.db.query('cloudDocumentLocations').withIndex('by_owner_and_folderId', q => q.eq('owner', ctx.owner).eq('folderId', row._id)).take(1),
    ])
    if (children.length || documents.length) throw new ConvexError('Move the folder’s drawings and child folders before deleting it')
    await ctx.db.delete(row._id)
    return null
  },
})

export const listDocuments = ownerQuery({
  args: { folderId: nullableFolderId, cursor }, returns: pageOf(workspaceDocument),
  handler: async (ctx, args) => {
    if (args.folderId) {
      await folder(ctx, ctx.owner, args.folderId)
      const result = await ctx.db.query('cloudDocumentLocations').withIndex('by_owner_and_folderId', q => q.eq('owner', ctx.owner).eq('folderId', args.folderId))
        .paginate({ numItems: 5, cursor: args.cursor })
      const page = await Promise.all(result.page.map(async location => {
        const row = await ctx.db.get(location.documentId)
        return row && row.owner === ctx.owner && !row.deletedAt ? { id: row.clientId, name: row.name, revision: row.revision, updatedAt: row.updatedAt, folderId: location.folderId, locationRevision: location.revision } : null
      }))
      return { page: page.filter(row => row !== null), continueCursor: result.continueCursor, isDone: result.isDone }
    }
    // Legacy drawings have no location row yet and remain visible at root.
    const result = await ctx.db.query('cloudDocuments').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc')
      .paginate({ numItems: 5, cursor: args.cursor })
    const page = await Promise.all(result.page.map(async row => {
      if (row.deletedAt) return null
      const location = await locationRow(ctx, ctx.owner, row._id)
      return !location?.folderId ? { id: row.clientId, name: row.name, revision: row.revision, updatedAt: row.updatedAt, folderId: null, locationRevision: location?.revision ?? null } : null
    }))
    return { page: page.filter(row => row !== null), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const moveDocument = ownerMutation({
  args: { id: v.string(), folderId: nullableFolderId, expectedRevision: v.number(), expectedLocationRevision: v.union(v.number(), v.null()) },
  returns: workspaceDocument,
  handler: async (ctx, args) => {
    const row = await documentRow(ctx, ctx.owner, args.id)
    if (!row || row.deletedAt) throw new ConvexError('Drawing is not available')
    requireRevision(row.revision, args.expectedRevision, 'Drawing')
    if (args.folderId) await folder(ctx, ctx.owner, args.folderId)
    const location = await locationRow(ctx, ctx.owner, row._id)
    requireRevision(location?.revision ?? null, args.expectedLocationRevision, 'Drawing location')
    const revision = (location?.revision ?? 0) + 1, updatedAt = Date.now()
    if (location) await ctx.db.patch(location._id, { folderId: args.folderId, revision, updatedAt })
    else await ctx.db.insert('cloudDocumentLocations', { owner: ctx.owner, documentId: row._id, folderId: args.folderId, revision, updatedAt })
    return { id: row.clientId, name: row.name, revision: row.revision, updatedAt: row.updatedAt, folderId: args.folderId, locationRevision: revision }
  },
})

export const listHistory = ownerQuery({
  args: { id: v.string(), cursor }, returns: pageOf(workspaceRevision),
  handler: async (ctx, args) => {
    const row = await documentRow(ctx, ctx.owner, args.id)
    if (!row) return emptyPage()
    const result = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', ctx.owner).eq('documentId', row._id))
      .order('desc').paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.map(item => ({ revision: item.revision, name: item.name, savedAt: item.savedAt, kind: item.kind, restoredFromRevision: item.restoredFromRevision ?? null })), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const readRevision = ownerQuery({
  args: { id: v.string(), revision: v.number() }, returns: v.union(remoteDocument, v.null()),
  handler: async (ctx, args) => {
    const row = await documentRow(ctx, ctx.owner, args.id)
    if (!row) return null
    const snapshot = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', ctx.owner).eq('documentId', row._id).eq('revision', args.revision)).unique()
    return snapshot ? { id: row.clientId, name: snapshot.name, docJson: snapshot.docJson, createdAt: row.createdAt, updatedAt: snapshot.savedAt, revision: snapshot.revision } : null
  },
})
export const restoreRevision = ownerMutation({
  args: { id: v.string(), revision: v.number(), expectedRevision: v.number() }, returns: remoteDocument,
  handler: async (ctx, args) => {
    const row = await documentRow(ctx, ctx.owner, args.id)
    if (!row) throw new ConvexError('Drawing is not available')
    requireRevision(row.revision, args.expectedRevision, 'Drawing')
    const snapshot = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', ctx.owner).eq('documentId', row._id).eq('revision', args.revision)).unique()
    if (!snapshot) throw new ConvexError('Revision is not available')
    validateDocumentJson(snapshot.docJson)
    await recordDocumentRevision(ctx, row, row.deletedAt ? 'delete' : 'save')
    const update = { name: snapshot.name, docJson: snapshot.docJson, revision: row.revision + 1, updatedAt: Date.now(), deletedAt: undefined }
    await ctx.db.patch(row._id, update)
    await recordDocumentRevision(ctx, { ...row, ...update }, 'restore', snapshot.revision)
    return { id: row.clientId, name: update.name, docJson: update.docJson, createdAt: row.createdAt, updatedAt: update.updatedAt, revision: update.revision }
  },
})
