import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { boundedText, cursor, remoteDocument, validateDocumentJson } from './validators'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { recordDocumentRevision } from './cloudWorkspaceHistory'

function view(row: Doc<'cloudDocuments'>) {
  return { id: row.clientId, name: row.name, docJson: row.docJson, createdAt: row.createdAt, updatedAt: row.updatedAt, revision: row.revision }
}
async function find(ctx: QueryCtx | MutationCtx, owner: string, id: string) {
  return ctx.db.query('cloudDocuments').withIndex('by_owner_and_clientId', q => q.eq('owner', owner).eq('clientId', id)).unique()
}
export const list = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(remoteDocument), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query('cloudDocuments').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc').paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.filter(row => !row.deletedAt).map(view), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const get = ownerQuery({
  args: { id: v.string() }, returns: v.union(remoteDocument, v.null()),
  handler: async (ctx, args) => { const row = await find(ctx, ctx.owner, args.id); return row && !row.deletedAt ? view(row) : null },
})
export const create = ownerMutation({
  args: { id: v.string(), name: v.string(), docJson: v.string() }, returns: remoteDocument,
  handler: async (ctx, args) => {
    validateDocumentJson(args.docJson)
    const clientId = boundedText(args.id, 'Document ID'), name = boundedText(args.name, 'Name')
    if (await find(ctx, ctx.owner, clientId)) throw new ConvexError('A cloud document already uses this ID; create a copy instead')
    const now = Date.now(), row = { owner: ctx.owner, clientId, name, docJson: args.docJson, createdAt: now, updatedAt: now, revision: 1 }
    const _id = await ctx.db.insert('cloudDocuments', row)
    await recordDocumentRevision(ctx, { ...row, _id })
    return { id: clientId, name, docJson: args.docJson, createdAt: now, updatedAt: now, revision: 1 }
  },
})
export const save = ownerMutation({
  args: { id: v.string(), name: v.string(), docJson: v.string(), expectedRevision: v.union(v.number(), v.null()) }, returns: remoteDocument,
  handler: async (ctx, args) => {
    validateDocumentJson(args.docJson)
    const name = boundedText(args.name, 'Name'), row = await find(ctx, ctx.owner, args.id)
    if (!row) {
      if (args.expectedRevision !== null) throw new ConvexError('Cloud drawing changed; refresh before saving')
      const now = Date.now()
      const created = { owner: ctx.owner, clientId: boundedText(args.id, 'Document ID'), name, docJson: args.docJson, createdAt: now, updatedAt: now, revision: 1 }
      const _id = await ctx.db.insert('cloudDocuments', created)
      await recordDocumentRevision(ctx, { ...created, _id })
      return { id: args.id, name, docJson: args.docJson, createdAt: now, updatedAt: now, revision: 1 }
    }
    if (row.deletedAt || row.revision !== args.expectedRevision) throw new ConvexError('Cloud drawing changed; refresh before saving')
    await recordDocumentRevision(ctx, row)
    const update = { name, docJson: args.docJson, updatedAt: Date.now(), revision: row.revision + 1 }
    await ctx.db.patch(row._id, update)
    await recordDocumentRevision(ctx, { ...row, ...update })
    return view({ ...row, ...update })
  },
})
export const remove = ownerMutation({
  args: { id: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await find(ctx, ctx.owner, args.id)
    if (row && !row.deletedAt) {
      await recordDocumentRevision(ctx, row)
      const update = { deletedAt: Date.now(), updatedAt: Date.now(), revision: row.revision + 1 }
      await ctx.db.patch(row._id, update)
      await recordDocumentRevision(ctx, { ...row, ...update }, 'delete')
    }
    return null
  },
})
