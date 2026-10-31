import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BoardImageList, BoardImageUploader } from './BoardImageAttachments'
import { CommunityReportButton } from './CommunityReportButton'
import { useTranslate } from '../hooks/useTranslate'
import { createCommunityBoardClient, type BoardPage, type BoardPost, type BoardTopic, type BoardTopicDetail, type CommunityBoardClient } from '../localdb/community-board-client'
import { getEditorCloudState, getEditorCloudTransport, subscribeEditorCloudState } from '../localdb/editor-cloud-connection'

export type CommunityBoardPanelProps = {
  client?: CommunityBoardClient
  signedIn?: boolean
  onStatus?: (message: string) => void
}
const emptyPage = <T,>(): BoardPage<T> => ({ page: [], continueCursor: '', isDone: true })
const mergePage = <T extends { id: string }>(old: BoardPage<T>, next: BoardPage<T>) => ({
  ...next, page: [...new Map([...old.page, ...next.page].map(row => [row.id, row])).values()],
})
const plainTextStyle = { whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const }

export function CommunityBoardPanel(props: CommunityBoardPanelProps) {
  const cloud = useSyncExternalStore(subscribeEditorCloudState, getEditorCloudState)
  const connection = useMemo(() => {
    if (props.client) return { client: props.client, error: '', sessionKey: cloud.sessionKey }
    if (!cloud.configured) return { client: null, error: '', sessionKey: cloud.sessionKey }
    try { return { client: createCommunityBoardClient(getEditorCloudTransport()), error: '', sessionKey: cloud.sessionKey } }
    catch (reason) { return { client: null, error: reason instanceof Error ? reason.message : 'Discussion connection is unavailable', sessionKey: cloud.sessionKey } }
  }, [props.client, cloud.configured, cloud.sessionKey])
  return <CommunityBoardSession key={connection.sessionKey} {...props} client={connection.client} signedIn={props.signedIn ?? Boolean(cloud.user)} connectionError={connection.error} />
}

function CommunityBoardSession({ client, signedIn, onStatus, connectionError }: {
  client: CommunityBoardClient | null; signedIn: boolean; onStatus?: (message: string) => void; connectionError: string
}) {
  const t = useTranslate()
  const [topics, setTopics] = useState<BoardPage<BoardTopic>>(emptyPage)
  const [posts, setPosts] = useState<BoardPage<BoardPost>>(emptyPage)
  const [topic, setTopic] = useState<BoardTopicDetail | null>(null)
  const [scope, setScope] = useState<'public' | 'drafts'>('public')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [composer, setComposer] = useState<{ id?: string; revision?: number; title: string; body: string; publish: boolean; attachments?: string[] } | null>(null)
  const [search, setSearch] = useState(''), [activeSearch, setActiveSearch] = useState(''), [autoRefresh, setAutoRefresh] = useState(false)
  const [reply, setReply] = useState(''), [editingPost, setEditingPost] = useState<{ id: string; revision: number; body: string; attachments?: string[] } | null>(null)
  const [removing, setRemoving] = useState<{ kind: 'topic' | 'post'; id: string; revision: number } | null>(null)
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]), [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const active = useRef(true), requests = useRef(0)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const list = async (nextScope: typeof scope, more = false) => {
    if (!client) return
    const request = ++requests.current
    const cursor = more ? topics.continueCursor : null
    const next = nextScope === 'public' && activeSearch && client.searchTopics ? await client.searchTopics(activeSearch, cursor) : await (nextScope === 'public' ? client.listTopics : client.listMyDrafts)(cursor)
    if (active.current && request === requests.current) { setTopics(previous => more ? mergePage(previous, next) : next); setScope(nextScope) }
  }
  const openTopic = async (id: string) => {
    if (!client) return
    const request = ++requests.current
    const [next, nextPosts] = await Promise.all([client.getTopic(id), client.listPosts(id)])
    if (!next) throw new Error(t('board.unavailable', 'This discussion is no longer available'))
    if (active.current && request === requests.current) { setTopic(next); setPosts(nextPosts); setComposer(null); setEditingPost(null); setReply(''); setReplyAttachments([]); setRemoving(null) }
  }
  const run = async (operation: () => Promise<void>, message?: string) => {
    setBusy(true); setError('')
    try { await operation(); if (active.current && message) onStatus?.(message) }
    catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : t('board.failed', 'Discussion operation did not complete')) }
    finally { if (active.current) setBusy(false) }
  }
  useEffect(() => {
    if (!client) return
    let cancelled = false
    const request = ++requests.current
    void client.listTopics().then(next => { if (!cancelled && request === requests.current) setTopics(next) }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load discussions')
    })
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    if (!client || !autoRefresh || busy || composer || editingPost || reply || replyAttachments.length || attachmentsUploading || removing) return
    let canceled = false
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      const request = ++requests.current
      void (async () => {
        if (topic) {
          const [next, nextPosts] = await Promise.all([client.getTopic(topic.id), client.listPosts(topic.id)])
          if (!canceled && active.current && request === requests.current) { setTopic(next); setPosts(nextPosts) }
        } else {
          const next = scope === 'public' && activeSearch && client.searchTopics ? await client.searchTopics(activeSearch) : await (scope === 'public' ? client.listTopics : client.listMyDrafts)()
          if (!canceled && active.current && request === requests.current) setTopics(next)
        }
      })().catch(reason => { if (!canceled && active.current) setError(reason instanceof Error ? reason.message : 'Could not refresh discussions') })
    }, 30_000)
    return () => { canceled = true; window.clearInterval(timer) }
  }, [client, autoRefresh, busy, composer, editingPost, reply, replyAttachments.length, attachmentsUploading, removing, topic, scope, activeSearch])

  if (!client) return <section aria-label={t('board.label', 'Community discussions')}>
    <h3>{t('board.title', 'Community discussions')}</h3>
    <p role={connectionError ? 'alert' : undefined}>{connectionError || t('board.notConfigured', 'Discussions are not available in this installation.')}</p>
  </section>

  const saveTopic = () => run(async () => {
    if (!composer || attachmentsUploading) return
    const input = { title: composer.title, body: composer.body, attachments: composer.attachments ?? [], status: composer.publish ? 'published' as const : 'draft' as const }
    const saved = composer.id ? await client.updateTopic(composer.id, input, composer.revision ?? 0) : await client.createTopic(input)
    await list(scope); await openTopic(saved.id)
  }, t('board.topicSaved', 'Discussion saved'))
  const like = (kind: 'topic' | 'post', row: BoardTopic | BoardPost) => run(async () => {
    const result = await client.setLike({ kind, id: row.id }, !row.likedByMe)
    if (!active.current) return
    if (kind === 'topic') {
      setTopics(previous => ({ ...previous, page: previous.page.map(item => item.id === row.id ? { ...item, ...result } : item) }))
      setTopic(previous => previous?.id === row.id ? { ...previous, ...result } : previous)
    } else setPosts(previous => ({ ...previous, page: previous.page.map(item => item.id === row.id ? { ...item, ...result } : item) }))
  })
  const remove = () => run(async () => {
    if (!removing) return
    if (removing.kind === 'topic') { await client.removeTopic(removing.id, removing.revision); if (active.current) setTopic(null); await list(scope) }
    else if (topic) { await client.removePost(removing.id, removing.revision); await openTopic(topic.id) }
    if (active.current) setRemoving(null)
  }, t('board.removed', 'Discussion content removed'))
  const likeButton = (kind: 'topic' | 'post', row: BoardTopic | BoardPost) => <button type="button" disabled={busy || !signedIn}
    aria-pressed={row.likedByMe} onClick={() => void like(kind, row)}>
    {row.likedByMe ? t('board.unlike', 'Unlike') : t('board.like', 'Like')} · {row.likeCount}
  </button>

  return <section aria-label={t('board.label', 'Community discussions')}>
    <h3>{t('board.title', 'Community discussions')}</h3>
    <p className="hint">{t('board.privacy', 'Topics and replies use a stable member alias. Published text is visible to everyone; drafts are private.')}</p>
    <div className="line-type-modal-actions">
      {topic && <button type="button" disabled={busy} onClick={() => { setTopic(null); setComposer(null); setRemoving(null); void run(() => list(scope)) }}>{t('board.back', 'Back to topics')}</button>}
      {!topic && <>
        <button type="button" disabled={busy} aria-pressed={scope === 'public'} onClick={() => void run(() => list('public'))}>{t('board.public', 'Public topics')}</button>
        {signedIn && <button type="button" disabled={busy} aria-pressed={scope === 'drafts'} onClick={() => void run(() => list('drafts'))}>{t('board.drafts', 'My drafts')}</button>}
      </>}
      <button type="button" disabled={busy} onClick={() => void run(() => topic ? openTopic(topic.id) : list(scope))}>{t('board.refresh', 'Refresh discussions')}</button>
      {signedIn && <button type="button" disabled={busy} onClick={() => setComposer({ title: '', body: '', publish: false })}>{t('board.new', 'Start a topic')}</button>}
    </div>
    <label><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} />{t('board.autoRefresh', 'Refresh discussions every 30 seconds while not writing')}</label>
    {!topic && scope === 'public' && client.searchTopics && <form onSubmit={event => { event.preventDefault(); setActiveSearch(search.trim()); void run(async () => { const request = ++requests.current; const next = search.trim() ? await client.searchTopics!(search.trim()) : await client.listTopics(); if (active.current && request === requests.current) setTopics(next) }) }}><label>{t('board.search', 'Search public topic titles')} <input maxLength={160} value={search} onChange={event => setSearch(event.target.value)} /></label><button disabled={busy}>{t('common.search', 'Search')}</button></form>}
    {!signedIn && <p className="hint">{t('board.signIn', 'Sign in to start a topic, reply, or like a post.')}</p>}
    {composer && <form onSubmit={event => { event.preventDefault(); void saveTopic() }}>
      <label>{t('board.topicTitle', 'Topic title')}<input value={composer.title} maxLength={160} required disabled={busy}
        onChange={event => setComposer({ ...composer, title: event.target.value })} /></label>
      <label>{t('board.topicText', 'Topic text')}<textarea value={composer.body} maxLength={5000} required disabled={busy}
        onChange={event => setComposer({ ...composer, body: event.target.value })} /></label>
      <BoardImageUploader ids={composer.attachments ?? []} onChange={attachments => setComposer({ ...composer, attachments })} onBusyChange={setAttachmentsUploading} />
      <label><input type="checkbox" checked={composer.publish} disabled={busy} onChange={event => setComposer({ ...composer, publish: event.target.checked })} />
        {t('board.publishChoice', 'Publish this topic for everyone')}</label>
      <div className="line-type-modal-actions"><button type="submit" disabled={busy || attachmentsUploading || !composer.title.trim() || !composer.body.trim()}>
        {composer.publish ? t('board.publish', 'Publish topic') : t('board.saveDraft', 'Save draft')}</button>
        <button type="button" disabled={busy} onClick={() => setComposer(null)}>{t('board.cancel', 'Cancel')}</button></div>
    </form>}
    {!topic && !composer && <>
      {topics.page.length === 0 && <p>{scope === 'drafts' ? t('board.noDrafts', 'No private drafts yet.') : t('board.noTopics', 'No public topics yet.')}</p>}
      {topics.page.map(row => <article key={row.id} className="template-item" style={{ display: 'block', marginBlock: 8 }}>
        <button type="button" disabled={busy} onClick={() => void run(() => openTopic(row.id))}>{row.title}</button>
        <p style={plainTextStyle}>{row.excerpt}</p><small>{row.author} · {row.replyCount} {t('board.replies', 'replies')}</small>
        {row.status === 'published' && likeButton('topic', row)}
        {signedIn && row.status === 'published' && <CommunityReportButton target={{ kind: 'topic', id: row.id }} />}
      </article>)}
      {!topics.isDone && <button type="button" disabled={busy} onClick={() => void run(() => list(scope, true))}>{t('board.moreTopics', 'Load more topics')}</button>}
    </>}
    {topic && !composer && <>
      <h4>{topic.title}</h4><small>{topic.author} · {topic.status === 'draft' ? t('board.privateDraft', 'Private draft') : new Date(topic.createdAt).toLocaleString()}</small>
      <p style={plainTextStyle}>{topic.body}</p>
      <BoardImageList ids={topic.attachments ?? []} target={{ kind: 'topic', id: topic.id }} />
      <div className="line-type-modal-actions">
        {topic.status === 'published' && likeButton('topic', topic)}
        {signedIn && topic.status === 'published' && <CommunityReportButton target={{ kind: 'topic', id: topic.id }} />}
        {signedIn && topic.isMine && <><button type="button" disabled={busy} onClick={() => setComposer({ id: topic.id, revision: topic.revision, title: topic.title, body: topic.body, publish: topic.status === 'published', attachments: topic.attachments ?? [] })}>{t('board.editTopic', 'Edit topic')}</button>
          <button type="button" disabled={busy} onClick={() => setRemoving({ kind: 'topic', id: topic.id, revision: topic.revision })}>{t('board.removeTopic', 'Remove topic')}</button></>}
      </div>
      <h4>{t('board.repliesHeading', 'Replies')}</h4>
      {posts.page.map(post => <article key={post.id} className="template-item" style={{ display: 'block', marginBlock: 8 }}>
        <small>{post.author} · {new Date(post.createdAt).toLocaleString()}</small>
        {editingPost?.id === post.id ? <form onSubmit={event => { event.preventDefault(); void run(async () => {
          if (attachmentsUploading) return
          await client.editPost(post.id, editingPost.body, editingPost.revision, editingPost.attachments ?? post.attachments ?? []); await openTopic(topic.id)
        }) }}><label>{t('board.editReply', 'Edit reply')}<textarea maxLength={4000} required disabled={busy} value={editingPost.body}
          onChange={event => setEditingPost({ ...editingPost, body: event.target.value })} /></label>
          <BoardImageUploader ids={editingPost.attachments ?? post.attachments ?? []} onChange={attachments => setEditingPost({ ...editingPost, attachments })} onBusyChange={setAttachmentsUploading} />
          <button type="submit" disabled={busy || attachmentsUploading || !editingPost.body.trim()}>{t('board.saveReply', 'Save reply')}</button>
          <button type="button" disabled={busy} onClick={() => setEditingPost(null)}>{t('board.cancel', 'Cancel')}</button>
        </form> : <><p style={plainTextStyle}>{post.body}</p><BoardImageList ids={post.attachments ?? []} target={{ kind: 'post', id: post.id }} /></>}
        <div className="line-type-modal-actions">{topic.status === 'published' && likeButton('post', post)}
          {signedIn && topic.status === 'published' && <CommunityReportButton target={{ kind: 'post', id: post.id }} />}
          {signedIn && post.isMine && <><button type="button" disabled={busy} onClick={() => setEditingPost({ id: post.id, revision: post.revision, body: post.body, attachments: post.attachments ?? [] })}>{t('board.editReply', 'Edit reply')}</button>
            <button type="button" disabled={busy} onClick={() => setRemoving({ kind: 'post', id: post.id, revision: post.revision })}>{t('board.removeReply', 'Remove reply')}</button></>}
        </div>
      </article>)}
      {!posts.isDone && <button type="button" disabled={busy} onClick={() => void run(async () => {
        const next = await client.listPosts(topic.id, posts.continueCursor)
        if (active.current) setPosts(previous => mergePage(previous, next))
      })}>{t('board.moreReplies', 'Load more replies')}</button>}
      {signedIn && topic.status === 'published' && <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (attachmentsUploading) return
        await client.createPost(topic.id, reply, replyAttachments); await openTopic(topic.id)
      }, t('board.replyPublished', 'Reply published')) }}>
        <label>{t('board.yourReply', 'Your reply')}<textarea maxLength={4000} required disabled={busy} value={reply} onChange={event => setReply(event.target.value)} /></label>
        <BoardImageUploader ids={replyAttachments} onChange={setReplyAttachments} onBusyChange={setAttachmentsUploading} />
        <button type="submit" disabled={busy || attachmentsUploading || !reply.trim()}>{t('board.postReply', 'Post reply')}</button>
      </form>}
    </>}
    {removing && <div role="group" aria-label={t('board.confirmRemoval', 'Confirm removal')}>
      <p>{removing.kind === 'topic' ? t('board.removeTopicNote', 'Remove this topic and hide its replies?') : t('board.removeReplyNote', 'Remove this reply?')}</p>
      <button type="button" disabled={busy} onClick={() => void remove()}>{t('board.confirm', 'Confirm removal')}</button>
      <button type="button" disabled={busy} onClick={() => setRemoving(null)}>{t('board.keep', 'Keep content')}</button>
    </div>}
    {busy && <p role="status">{t('board.loading', 'Loading discussions…')}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
