import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { checkedCloudPage, emptyCloudPage, mergeCloudPage, type CloudPage } from '../localdb/cloud-types'
import { getEditorCloudTransport } from '../localdb/editor-cloud-connection'
import type { CommunityReportTarget } from './CommunityReportButton'

type Notification = { id: string; topicId: string; title: string; createdAt: number; read: boolean; available: boolean }
type Report = { id: string; target: CommunityReportTarget; reason: string; title: string; excerpt: string; revision: number; visibilityRevision: number; available: boolean; createdAt: number }
type Audit = { id: string; target: CommunityReportTarget; action: 'hide' | 'dismiss'; reason: string; targetRevision: number; createdAt: number }
export function CommunityOperationsPanel() {
  const t = useTranslate(), transport = useMemo(() => getEditorCloudTransport(), [])
  const [notifications, setNotifications] = useState(emptyCloudPage<Notification>)
  const [reports, setReports] = useState(emptyCloudPage<Report>)
  const [audit, setAudit] = useState(emptyCloudPage<Audit>)
  const [moderator, setModerator] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const refresh = async () => {
    const [items, capabilities] = await Promise.all([transport.query<CloudPage<Notification>>('communityNotifications:list', { cursor: null }), transport.query<{ moderator: boolean }>('communityModeration:capabilities', {})])
    if (!active.current) return
    setNotifications(checkedCloudPage(items)); setModerator(capabilities.moderator)
    if (capabilities.moderator) {
      const [queue, decisions] = await Promise.all([transport.query<CloudPage<Report>>('communityModeration:list', { cursor: null }), transport.query<CloudPage<Audit>>('communityModeration:audit', { cursor: null })])
      if (active.current) { setReports(checkedCloudPage(queue)); setAudit(checkedCloudPage(decisions)) }
    }
  }
  useEffect(() => {
    let canceled = false
    void Promise.all([transport.query<CloudPage<Notification>>('communityNotifications:list', { cursor: null }), transport.query<{ moderator: boolean }>('communityModeration:capabilities', {})]).then(([items, capabilities]) => {
      if (!canceled) { setNotifications(checkedCloudPage(items)); setModerator(capabilities.moderator) }
    }).catch(error => { if (!canceled) setError(error instanceof Error ? error.message : 'Could not load community tools') })
    return () => { canceled = true }
  }, [transport])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await operation() } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Community operation failed') }
    finally { if (active.current) setBusy(false) }
  }
  return <section aria-label={t('community.tools', 'Community notifications and moderation')}>
    <h3>{t('community.notifications', 'Reply notifications')}</h3>
    <button disabled={busy} onClick={() => void run(refresh)}>{t('community.refreshTools', 'Refresh notifications and reports')}</button>
    <p>{t('community.notificationHint', 'Replies to your topics appear here. The newest 1,000 notifications are retained. Open the discussion board to read or reply.')}</p>
    <ul>{notifications.page.map(item => <li key={item.id}>{item.title} · {new Date(item.createdAt).toLocaleString()}{' '}
      {!item.read && <button disabled={busy} onClick={() => void run(async () => { await transport.mutation('communityNotifications:markRead', { id: item.id }); await refresh() })}>{t('community.markRead', 'Mark read')}</button>}
    </li>)}</ul>
    {!notifications.isDone && <button disabled={busy} onClick={() => void run(async () => { const next = checkedCloudPage(await transport.query<CloudPage<Notification>>('communityNotifications:list', { cursor: notifications.continueCursor })); if (active.current) setNotifications(previous => mergeCloudPage(previous, next)) })}>{t('community.moreNotifications', 'Load more notifications')}</button>}
    {moderator && <details><summary>{t('community.moderation', 'Moderator review queue')}</summary>
      <p>{t('community.moderatorHint', 'Refresh to load reports. Hiding a topic also hides its replies; hiding a pattern blocks republishing that pattern. Each decision requires a reason and is recorded in the audit log.')}</p>
      <label>{t('community.decisionReason', 'Decision reason')} <textarea maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      {reports.page.map(report => <article key={report.id} className="template-item" style={{ display: 'block' }}><h4>{report.title}</h4><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.excerpt}</p><p>{t('community.reportReason', 'Report reason')}: {report.reason}</p>
        {(['hide', 'dismiss'] as const).map(action => <button key={action} disabled={busy || !reason.trim() || (action === 'hide' && !report.available)} onClick={() => void run(async () => { await transport.mutation('communityModeration:resolve', { id: report.id, action, reason, expectedRevision: report.revision, expectedVisibilityRevision: report.visibilityRevision }); setReason(''); await refresh() })}>{action === 'hide' ? t('community.hide', 'Hide reported content') : t('community.dismiss', 'Dismiss report')}</button>)}
      </article>)}
      {!reports.isDone && <button disabled={busy} onClick={() => void run(async () => { const next = checkedCloudPage(await transport.query<CloudPage<Report>>('communityModeration:list', { cursor: reports.continueCursor })); if (active.current) setReports(previous => mergeCloudPage(previous, next)) })}>{t('community.moreReports', 'Load more reports')}</button>}
      <h4>{t('community.audit', 'Moderation audit log')}</h4>
      <ul>{audit.page.map(item => <li key={item.id}>{item.action} · {item.target.kind} · {t('cloudWorkspace.revision', 'revision')} {item.targetRevision} · {item.reason} · {new Date(item.createdAt).toLocaleString()}</li>)}</ul>
      {!audit.isDone && <button disabled={busy} onClick={() => void run(async () => { const next = checkedCloudPage(await transport.query<CloudPage<Audit>>('communityModeration:audit', { cursor: audit.continueCursor })); if (active.current) setAudit(previous => mergeCloudPage(previous, next)) })}>{t('community.moreAudit', 'Load more audit records')}</button>}
    </details>}
    {error && <p role="alert">{error}</p>}
  </section>
}
