import type { ConvexTransport } from './convex-transport'

export type BoardTopicStatus = 'draft' | 'published'
export type BoardTopic = {
  id: string
  authorId: string
  author: string
  title: string
  excerpt: string
  status: BoardTopicStatus
  revision: number
  createdAt: number
  updatedAt: number
  replyCount: number
  likeCount: number
  likedByMe: boolean
  isMine: boolean
}
export type BoardTopicDetail = BoardTopic & { body: string }
export type BoardPost = {
  id: string
  topicId: string
  authorId: string
  author: string
  body: string
  revision: number
  createdAt: number
  updatedAt: number
  likeCount: number
  likedByMe: boolean
  isMine: boolean
}
export type BoardPage<T> = { page: T[]; continueCursor: string; isDone: boolean }
export type BoardLikeTarget = { kind: 'topic' | 'post'; id: string }
export type BoardTopicInput = { title: string; body: string; status: BoardTopicStatus }
export type BoardLikeResult = { likeCount: number; likedByMe: boolean }
export type CommunityBoardClient = {
  listTopics(cursor?: string | null): Promise<BoardPage<BoardTopic>>
  listMyDrafts(cursor?: string | null): Promise<BoardPage<BoardTopic>>
  getTopic(id: string): Promise<BoardTopicDetail | null>
  listPosts(topicId: string, cursor?: string | null): Promise<BoardPage<BoardPost>>
  createTopic(input: BoardTopicInput): Promise<BoardTopicDetail>
  updateTopic(id: string, input: BoardTopicInput, expectedRevision: number): Promise<BoardTopicDetail>
  removeTopic(id: string, expectedRevision: number): Promise<void>
  createPost(topicId: string, body: string): Promise<BoardPost>
  editPost(id: string, body: string, expectedRevision: number): Promise<BoardPost>
  removePost(id: string, expectedRevision: number): Promise<void>
  setLike(target: BoardLikeTarget, liked: boolean): Promise<BoardLikeResult>
}

function checkedPage<T>(value: BoardPage<T>): BoardPage<T> {
  if (!value || !Array.isArray(value.page) || value.page.length > 20 || typeof value.continueCursor !== 'string' || typeof value.isDone !== 'boolean'
    || (!value.isDone && !value.continueCursor)) throw new Error('Cloud returned an invalid discussion page')
  return value
}

/** One bounded page per request. The UI decides when to fetch another page. */
export function createCommunityBoardClient(transport: ConvexTransport): CommunityBoardClient {
  return {
    listTopics: async (cursor = null) => checkedPage(await transport.query<BoardPage<BoardTopic>>('communityBoard:listPublicTopics', { cursor })),
    listMyDrafts: async (cursor = null) => checkedPage(await transport.query<BoardPage<BoardTopic>>('communityBoard:listMyDrafts', { cursor })),
    getTopic: id => transport.query('communityBoard:getTopic', { id }),
    listPosts: async (topicId, cursor = null) => checkedPage(await transport.query<BoardPage<BoardPost>>('communityBoard:listPosts', { topicId, cursor })),
    createTopic: input => transport.mutation('communityBoard:createTopic', input),
    updateTopic: (id, input, expectedRevision) => transport.mutation('communityBoard:updateTopic', { id, ...input, expectedRevision }),
    removeTopic: async (id, expectedRevision) => { await transport.mutation('communityBoard:removeTopic', { id, expectedRevision }) },
    createPost: (topicId, body) => transport.mutation('communityBoard:createPost', { topicId, body }),
    editPost: (id, body, expectedRevision) => transport.mutation('communityBoard:editPost', { id, body, expectedRevision }),
    removePost: async (id, expectedRevision) => { await transport.mutation('communityBoard:removePost', { id, expectedRevision }) },
    setLike: (target, liked) => transport.mutation('communityBoard:setLike', { target, liked }),
  }
}
