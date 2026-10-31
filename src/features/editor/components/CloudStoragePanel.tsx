import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { emptyCloudPage, mergeCloudPage, checkedCloudPage, type CloudPage } from '../localdb/cloud-types'
import { getEditorCloudState, getEditorCloudTransport } from '../localdb/editor-cloud-connection'

type Asset = { id: string; name: string; size: number; ready: boolean; createdAt: number }
export function CloudStoragePanel() {
  const t = useTranslate()
  const session = getEditorCloudState().sessionKey
  const transport = useMemo(() => getEditorCloudTransport(), [])
  const [page, setPage] = useState(emptyCloudPage<Asset>)
  const [usage, setUsage] = useState<{ bytes: number; drawings: number; maximumBytes: number; maximumDrawings: number; ready: boolean } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async (cursor: string | null = null) => {
    const quota = await transport.query<NonNullable<typeof usage>>('cloudQuota:status', {})
    if (getEditorCloudState().sessionKey === session && typeof quota?.bytes === 'number') setUsage(quota)
    const next = checkedCloudPage(await transport.query<CloudPage<Asset>>('cloudAssets:list', { cursor }))
    if (getEditorCloudState().sessionKey === session) setPage(previous => cursor ? mergeCloudPage(previous, next) : next)
  }
  useEffect(() => {
    let active = true
    void transport.query<CloudPage<Asset>>('cloudAssets:list', { cursor: null }).then(value => { if (active) setPage(checkedCloudPage(value)) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load storage') })
    void transport.query<NonNullable<typeof usage>>('cloudQuota:status', {}).then(value => { if (active && typeof value?.bytes === 'number') setUsage(value) }).catch(() => undefined)
    return () => { active = false }
  }, [transport])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await operation() } catch (reason) { if (getEditorCloudState().sessionKey === session) setError(reason instanceof Error ? reason.message : 'Storage operation failed') }
    finally { if (getEditorCloudState().sessionKey === session) setBusy(false) }
  }
  return <details><summary>{t('cloudStorage.title', 'Cloud images and storage')}</summary>
    <p>{t('cloudStorage.policy', 'Large embedded images, PDFs and manufacturing fonts upload separately. Limits: 8 MiB per image/PDF, 4 MiB per font, 64 MiB and 128 files per account. The newest 100 drawing revisions are retained. Publication versions keep their referenced assets. Only unused files and unfinished upload reservations can be removed here.')}</p>
    {usage && <p>{t('cloudStorage.jsonUsage', 'Drawing, history, library, publication and discussion content')}: {(usage.bytes / 1024 / 1024).toFixed(2)} / {usage.maximumBytes / 1024 / 1024} MiB · {usage.drawings} / {usage.maximumDrawings} {t('cloudLibrary.drawings', 'drawings')}. {!usage.ready && t('cloudStorage.indexNeeded', 'Use Index older cloud drawings to finish storage accounting.')}</p>}
    <button disabled={busy} onClick={() => void run(() => load())}>{t('common.refresh', 'Refresh')}</button>
    <ul>{page.page.map(asset => <li key={asset.id}>{asset.name} · {Math.ceil(asset.size / 1024)} KiB · {asset.ready ? t('cloudStorage.ready', 'stored') : t('cloudStorage.pending', 'unfinished upload')}{' '}
      <button disabled={busy} onClick={() => void run(async () => { await transport.mutation('cloudAssets:remove', { id: asset.id }); await load() })}>{t('cloudStorage.remove', 'Remove unused file')}</button>
    </li>)}</ul>
    {!page.isDone && <button disabled={busy} onClick={() => void run(() => load(page.continueCursor))}>{t('cloudStorage.more', 'Load more files')}</button>}
    {error && <p role="alert">{error}</p>}
  </details>
}
