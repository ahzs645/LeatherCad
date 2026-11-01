import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeValue, cleanupRender, click, getByText, renderForTest } from '../../../test/render'
import type { BoardLikeTarget, BoardPage, BoardTopicDetail, BoardTopicInput, CommunityBoardClient } from '../localdb/community-board-client'
import { configureEditorCloudAuth } from '../localdb/editor-cloud-connection'
import { setEditorLocale } from '../ops/locale-store'
import { CommunityBoardPanel } from './CommunityBoardPanel'

let rendered: ReturnType<typeof renderForTest> | null = null
let disconnect: (() => void) | undefined
afterEach(() => { cleanupRender(rendered); rendered = null; disconnect?.(); disconnect = undefined; setEditorLocale('en') })
const topic = (values: Partial<BoardTopicDetail> = {}): BoardTopicDetail => ({
  id: 'topic-1', authorId: 'author-1', author: 'Member 12345', title: 'Pattern question', body: 'A question about a pattern',
  excerpt: 'A question about a pattern', status: 'published', revision: 1, createdAt: 1, updatedAt: 1,
  replyCount: 0, likeCount: 3, likedByMe: false, isMine: false, ...values,
})
const page = <T,>(rows: T[]): BoardPage<T> => ({ page: rows, continueCursor: '', isDone: true })
function client(initial: BoardTopicDetail[] = []): CommunityBoardClient {
  let records = initial
  return {
    listTopics: vi.fn(async () => page(records.filter(row => row.status === 'published'))),
    listMyDrafts: vi.fn(async () => page(records.filter(row => row.status === 'draft'))),
    getTopic: vi.fn(async (id: string) => records.find(row => row.id === id) ?? null),
    listPosts: vi.fn(async () => page([])),
    createTopic: vi.fn(async (input: BoardTopicInput) => {
      const created = topic({ ...input, id: 'created-topic', excerpt: input.body, isMine: true })
      records = [...records, created]
      return created
    }),
    updateTopic: vi.fn(async (id: string, input: BoardTopicInput, expectedRevision: number) => {
      const updated = topic({ ...input, id, excerpt: input.body, isMine: true, revision: expectedRevision + 1 })
      records = records.map(row => row.id === id ? updated : row)
      return updated
    }),
    removeTopic: vi.fn(async () => {}),
    createPost: vi.fn(), editPost: vi.fn(), removePost: vi.fn(),
    setLike: vi.fn(async (_target: BoardLikeTarget, liked: boolean) => ({ likeCount: liked ? 4 : 3, likedByMe: liked })),
  }
}
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }
function button(text: string) { return getByText<HTMLButtonElement>(rendered!.container, 'button', text) }
function submit() {
  const form = rendered!.container.querySelector('form')
  if (!form) throw new Error('Form is missing')
  act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}

describe('community board interface', () => {
  it('renders discussion text literally and leaves public visitors read-only', async () => {
    const text = '<img src=x onerror="alert(1)"><script>unsafe()</script>'
    const api = client([topic({ title: text, body: text, excerpt: text })])
    rendered = renderForTest(createElement(CommunityBoardPanel, { client: api, signedIn: false }))
    await settle()
    expect(rendered.container.querySelector('img, script')).toBeNull()
    expect(rendered.container.textContent).toContain(text)
    expect(button('Like · 3').disabled).toBe(true)
    expect(rendered.container.textContent).not.toContain('Start a topic')
    click(button(text)); await settle()
    expect(rendered.container.querySelector('img, script, textarea')).toBeNull()
    expect(rendered.container.textContent).toContain('Sign in to start a topic')
    expect(api.setLike).not.toHaveBeenCalled()
  })

  it('saves a private draft and sends the captured revision when its author edits it', async () => {
    const api = client()
    rendered = renderForTest(createElement(CommunityBoardPanel, { client: api, signedIn: true }))
    await settle(); click(button('Start a topic'))
    changeValue(rendered.container.querySelector('form input:not([type="checkbox"])'), 'My private draft')
    changeValue(rendered.container.querySelector('form textarea'), 'Private working notes')
    expect(rendered.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false)
    submit(); await settle()
    expect(api.createTopic).toHaveBeenCalledWith({ title: 'My private draft', body: 'Private working notes', status: 'draft', attachments: [] })
    expect(rendered.container.textContent).toContain('Private draft')
    click(button('Edit topic'))
    changeValue(rendered.container.querySelector('form textarea'), 'Revised private notes')
    submit(); await settle()
    expect(api.updateTopic).toHaveBeenCalledWith('created-topic', { title: 'My private draft', body: 'Revised private notes', status: 'draft', attachments: [] }, 1)
    expect(rendered.container.textContent).toContain('Revised private notes')
  })

  it('discards a delayed private draft response when the signed-in identity changes', async () => {
    let user = { id: 'alice', displayName: 'Alice' }, notify = () => {}
    disconnect = configureEditorCloudAuth({
      getUser: () => user, getToken: async () => 'in-memory-test-token', signIn: async () => {}, signOut: async () => {},
      subscribe: listener => { notify = listener; return () => {} },
    }, { url: 'https://board-test.convex.cloud' })
    const api = client()
    let release: (value: BoardPage<BoardTopicDetail>) => void = () => {}
    vi.mocked(api.listMyDrafts).mockImplementation(() => new Promise(resolve => { release = resolve }))
    rendered = renderForTest(createElement(CommunityBoardPanel, { client: api }))
    await settle(); click(button('My drafts'))
    act(() => { user = { id: 'bob', displayName: 'Bob' }; notify() })
    await settle()
    await act(async () => { release(page([topic({ title: 'Alice private text', status: 'draft', isMine: true })])); await Promise.resolve() })
    expect(rendered.container.textContent).not.toContain('Alice private text')
    expect(rendered.container.textContent).toContain('No public topics yet.')
  })
})
