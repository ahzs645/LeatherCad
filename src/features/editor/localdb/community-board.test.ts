import { describe, expect, it, vi } from 'vitest'
import { defineTestApp } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from '../../../../convex/schema'
import * as communityBoard from '../../../../convex/communityBoard'
import { createCommunityBoardClient } from './community-board-client'
import type { ConvexTransport } from './convex-transport'

const app = defineTestApp({ schema }).defineModules({ communityBoard })
function setup() {
  const server = app.createTest()
  const alice = server.withIdentity({ subject: 'alice', issuer: 'https://identity.test', name: 'alice@example.test', email: 'alice@example.test' })
  const bob = server.withIdentity({ subject: 'bob', issuer: 'https://identity.test', name: 'Bob' })
  const transport = (actor: Pick<typeof alice, 'query' | 'mutation'>): ConvexTransport => ({
    query: <T>(path: string, args: Record<string, unknown>) => actor.query(makeFunctionReference<'query', Record<string, unknown>, T>(path), args),
    mutation: <T>(path: string, args: Record<string, unknown>) => actor.mutation(makeFunctionReference<'mutation', Record<string, unknown>, T>(path), args),
  })
  return { server, alice, bob, a: createCommunityBoardClient(transport(alice)), b: createCommunityBoardClient(transport(bob)), guest: createCommunityBoardClient(transport(server)) }
}
const publicTopic = { title: 'Wallet stitch spacing', body: 'How do you plan the corner holes?', status: 'published' as const }

describe('community discussion board authorization and client', () => {
  it('shows only published content publicly, isolates drafts and never exposes identity email/subject', async () => {
    const { a, b, guest } = setup()
    await expect(guest.createTopic(publicTopic)).rejects.toThrow('Sign in')
    await expect(guest.listMyDrafts()).rejects.toThrow('Sign in')
    const draft = await a.createTopic({ ...publicTopic, body: 'Private draft notes', status: 'draft' })
    expect(await guest.getTopic(draft.id)).toBeNull()
    expect(await b.getTopic(draft.id)).toBeNull()
    expect((await guest.listTopics()).page).toEqual([])
    expect((await b.listMyDrafts()).page).toEqual([])
    expect((await a.listMyDrafts()).page[0].isMine).toBe(true)
    const shared = await a.updateTopic(draft.id, publicTopic, draft.revision)
    const reply = await b.createPost(shared.id, 'I use a shorter pitch around the curve.')
    const publicView = await guest.getTopic(shared.id)
    expect(publicView).toMatchObject({ status: 'published', replyCount: 1, isMine: false, likedByMe: false })
    expect(publicView?.author).toMatch(/^Member /)
    expect(JSON.stringify(publicView)).not.toContain('alice@example.test')
    expect(JSON.stringify(publicView)).not.toContain('identity.test')
    expect(publicView).not.toHaveProperty('owner')
    expect((await guest.listPosts(shared.id)).page[0].id).toBe(reply.id)
    const hidden = await a.updateTopic(shared.id, { ...publicTopic, status: 'draft' }, shared.revision)
    expect(await b.getTopic(shared.id)).toBeNull()
    expect((await guest.listPosts(shared.id)).page).toEqual([])
    await expect(b.createPost(shared.id, 'Not visible')).rejects.toThrow('not available')
    await expect(b.setLike({ kind: 'post', id: reply.id }, true)).rejects.toThrow('not available')
    expect((await a.getTopic(hidden.id))?.body).toBe(publicTopic.body)
  })

  it('guards other authors and rejects stale topic/reply edits and removals', async () => {
    const { a, b } = setup()
    const topic = await a.createTopic(publicTopic)
    const post = await b.createPost(topic.id, 'My original reply')
    await expect(b.updateTopic(topic.id, publicTopic, topic.revision)).rejects.toThrow('not available')
    await expect(b.removeTopic(topic.id, topic.revision)).rejects.toThrow('not available')
    await expect(a.editPost(post.id, 'Overwrite Bob', post.revision)).rejects.toThrow('not available')
    await expect(a.removePost(post.id, post.revision)).rejects.toThrow('not available')
    const revised = await a.updateTopic(topic.id, { ...publicTopic, body: 'Newer topic text' }, topic.revision)
    await expect(a.updateTopic(topic.id, publicTopic, topic.revision)).rejects.toThrow('changed; refresh')
    await expect(a.removeTopic(topic.id, topic.revision)).rejects.toThrow('changed; refresh')
    expect((await a.getTopic(topic.id))?.body).toBe('Newer topic text')
    const revisedPost = await b.editPost(post.id, 'Newer reply text', post.revision)
    await expect(b.editPost(post.id, 'Stale reply', post.revision)).rejects.toThrow('changed; refresh')
    await expect(b.removePost(post.id, post.revision)).rejects.toThrow('changed; refresh')
    await b.removePost(post.id, revisedPost.revision)
    await b.removePost(post.id, revisedPost.revision)
    expect((await a.getTopic(topic.id))?.replyCount).toBe(0)
    expect((await a.listPosts(topic.id)).page).toEqual([])
    await a.removeTopic(topic.id, revised.revision)
    expect(await a.getTopic(topic.id)).toBeNull()
  })

  it('makes like writes idempotent and transactional without changing content revisions', async () => {
    const { server, a, b, guest } = setup()
    const topic = await a.createTopic(publicTopic)
    const target = { kind: 'topic' as const, id: topic.id }
    await expect(guest.setLike(target, true)).rejects.toThrow('Sign in')
    await Promise.all([a.setLike(target, true), a.setLike(target, true)])
    expect(await a.setLike(target, true)).toEqual({ likeCount: 1, likedByMe: true })
    expect(await b.setLike(target, true)).toEqual({ likeCount: 2, likedByMe: true })
    await a.setLike(target, false); await a.setLike(target, false)
    expect((await guest.getTopic(topic.id))?.likeCount).toBe(1)
    expect((await a.getTopic(topic.id))?.likedByMe).toBe(false)
    const updated = await a.updateTopic(topic.id, { ...publicTopic, body: 'Edited after reactions' }, topic.revision)
    expect(updated.revision).toBe(2)
    const likes = await server.run(ctx => ctx.db.query('communityBoardLikes').take(5))
    expect(likes).toHaveLength(1)
    const post = await a.createPost(topic.id, 'A reply')
    expect(await b.setLike({ kind: 'post', id: post.id }, true)).toEqual({ likeCount: 1, likedByMe: true })
    await a.removePost(post.id, post.revision)
    await expect(b.setLike({ kind: 'post', id: post.id }, false)).rejects.toThrow('not available')
  })

  it('paginates topics and replies in bounded pages without leaking private rows', async () => {
    const { a, b, guest } = setup()
    for (let i = 0; i < 23; i += 1) await a.createTopic({ ...publicTopic, title: `Topic ${i}` })
    await a.createTopic({ ...publicTopic, status: 'draft', title: 'Private draft' })
    const first = await guest.listTopics()
    expect(first.page).toHaveLength(20); expect(first.isDone).toBe(false)
    const second = await guest.listTopics(first.continueCursor)
    expect(second.page).toHaveLength(3); expect(second.isDone).toBe(true)
    const ids = [...first.page, ...second.page].map(row => row.id)
    expect(new Set(ids).size).toBe(23)
    const topic = first.page[0]
    for (let i = 0; i < 23; i += 1) await b.createPost(topic.id, `Reply ${i}`)
    const posts = await guest.listPosts(topic.id)
    expect(posts.page).toHaveLength(20); expect(posts.isDone).toBe(false)
    const later = await guest.listPosts(topic.id, posts.continueCursor)
    expect(later.page).toHaveLength(3); expect(later.isDone).toBe(true)
    expect(posts.page[0].body).toBe('Reply 0')
    expect(later.page[2].body).toBe('Reply 22')
  })

  it('rejects invalid text and preserves stable author identity across topics and replies', async () => {
    const { server, a } = setup()
    await expect(a.createTopic({ ...publicTopic, title: ' ' })).rejects.toThrow('Topic title')
    await expect(a.createTopic({ ...publicTopic, body: 'x'.repeat(5001) })).rejects.toThrow('Topic text')
    expect(await server.run(ctx => ctx.db.query('communityBoardAuthors').take(1))).toEqual([])
    const first = await a.createTopic(publicTopic), next = await a.createTopic({ ...publicTopic, title: 'Another topic' })
    const post = await a.createPost(first.id, '<script>alert("literal text")</script>')
    expect(first.authorId).toBe(next.authorId); expect(post.authorId).toBe(first.authorId)
    await expect(a.createPost(first.id, 'x'.repeat(4001))).rejects.toThrow('Reply')
    await a.removePost(post.id, post.revision)
    const removed = await server.run(ctx => ctx.db.query('communityBoardPosts').take(1))
    expect(removed[0]).toMatchObject({ status: 'removed', body: '' })
  })

  it('rejects malformed or oversized page responses instead of loading unbounded content', async () => {
    const transport: ConvexTransport = { query: vi.fn().mockResolvedValue({ page: [], isDone: false, continueCursor: '' }), mutation: vi.fn() }
    await expect(createCommunityBoardClient(transport).listTopics()).rejects.toThrow('invalid discussion page')
    vi.mocked(transport.query).mockResolvedValue({ page: Array(21).fill({}), isDone: true, continueCursor: '' })
    await expect(createCommunityBoardClient(transport).listPosts('topic-id')).rejects.toThrow('invalid discussion page')
    expect(transport.query).toHaveBeenLastCalledWith('communityBoard:listPosts', { topicId: 'topic-id', cursor: null })
  })
})
