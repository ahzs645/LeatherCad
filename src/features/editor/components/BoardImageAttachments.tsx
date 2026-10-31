import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { uploadCloudAsset } from '../localdb/cloud-asset-client'
import { getEditorCloudTransport } from '../localdb/editor-cloud-connection'
import type { ConvexTransport } from '../localdb/convex-transport'

type BoardTarget = { kind: 'topic' | 'post'; id: string }
const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
function connection(): ConvexTransport | null { try { return getEditorCloudTransport() } catch { return null } }
export function BoardImageList({ ids, target }: { ids: string[]; target?: BoardTarget }) {
  const t = useTranslate(), transport = useMemo(() => connection(), [])
  const [images, setImages] = useState<{ id: string; url: string | null }[]>([])
  const key = ids.join('|'), kind = target?.kind, targetId = target?.id
  useEffect(() => {
    let active = true
    if (!transport || !key) return
    void Promise.all(key.split('|').slice(0, 6).map(async id => {
      const result = await transport.query<{ url: string; contentType: string } | null>('cloudAssets:resolve', { id, patternId: null, version: null, ...(kind && targetId ? { board: { kind, id: targetId } } : {}) })
      return { id, url: result && allowed.has(result.contentType) ? result.url : null }
    })).then(next => { if (active) setImages(next) }).catch(() => { if (active) setImages(key.split('|').map(id => ({ id, url: null }))) })
    return () => { active = false }
  }, [transport, key, kind, targetId])
  if (!key) return null
  return <div className="board-image-list">{images.map((image, index) => image.url ? <figure key={image.id}><img src={image.url} alt={`${t('board.attachedImage', 'Attached image')} ${index + 1}`} loading="lazy" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }} /></figure> : <p key={image.id}>{t('board.imageUnavailable', 'An attached image is no longer available.')}</p>)}</div>
}

type Upload = { key: string; file: File; progress: number; state: 'uploading' | 'failed'; error?: string }
export function BoardImageUploader({ ids, onChange, onBusyChange }: { ids: string[]; onChange(ids: string[]): void; onBusyChange(busy: boolean): void }) {
  const t = useTranslate(), transport = useMemo(() => connection(), [])
  const [uploads, setUploads] = useState<Upload[]>([]), [error, setError] = useState('')
  const active = useRef(true), idsRef = useRef(ids), onChangeRef = useRef(onChange)
  useEffect(() => { idsRef.current = ids; onChangeRef.current = onChange })
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const busy = uploads.some(upload => upload.state === 'uploading')
  useEffect(() => { onBusyChange(uploads.length > 0); return () => onBusyChange(false) }, [uploads.length, onBusyChange])
  const upload = async (job: Upload) => {
    if (!transport) return
    setUploads(previous => previous.map(item => item.key === job.key ? { ...item, state: 'uploading', error: undefined, progress: 0 } : item))
    try {
      const id = await uploadCloudAsset(job.file, job.file.name, transport, progress => { if (active.current) setUploads(previous => previous.map(item => item.key === job.key ? { ...item, progress } : item)) })
      if (!active.current) return
      const next = [...new Set([...idsRef.current, id])]
      if (next.length > 6) throw new Error(t('board.imageLimit', 'A topic or reply can contain at most six images'))
      idsRef.current = next; onChangeRef.current(next)
      setUploads(previous => previous.filter(item => item.key !== job.key))
    } catch (reason) { if (active.current) setUploads(previous => previous.map(item => item.key === job.key ? { ...item, state: 'failed', error: reason instanceof Error ? reason.message : 'Image upload failed' } : item)) }
  }
  return <fieldset><legend>{t('board.images', 'Images')}</legend>
    <p>{t('board.imagesHint', 'PNG, JPEG, WebP or GIF. Up to six images, 8 MiB each and 24 MiB total. Wait for uploads before saving. Draft images are private; published images follow the topic’s visibility.')}</p>
    <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={!transport || busy || ids.length + uploads.length >= 6} aria-label={t('board.addImages', 'Add discussion images')} onChange={event => {
      const files = [...(event.currentTarget.files ?? [])]; event.currentTarget.value = ''; setError('')
      if (ids.length + uploads.length + files.length > 6) { setError(t('board.imageLimit', 'A topic or reply can contain at most six images')); return }
      if (files.some(file => !allowed.has(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 24 * 1024 * 1024) { setError(t('board.imageSize', 'Choose supported images up to 8 MiB each and 24 MiB total')); return }
      const jobs = files.map(file => ({ key: crypto.randomUUID(), file, progress: 0, state: 'uploading' as const }))
      setUploads(previous => [...previous, ...jobs])
      void (async () => { for (const job of jobs) await upload(job) })()
    }} />
    {!transport && <p>{t('board.uploadUnavailable', 'Image upload is unavailable for this connection.')}</p>}
    <BoardImageList ids={ids} />
    <ul>{ids.map((id, index) => <li key={id}>{t('board.attachedImage', 'Attached image')} {index + 1} <button type="button" disabled={busy} onClick={() => { const next = idsRef.current.filter(item => item !== id); idsRef.current = next; onChangeRef.current(next) }}>{t('board.removeImage', 'Remove image')}</button></li>)}</ul>
    {uploads.map(job => <div key={job.key}><span>{job.file.name}</span>{job.state === 'uploading' ? <progress max={100} value={job.progress} aria-label={`${t('board.uploadingImage', 'Uploading image')}: ${job.file.name}`}>{job.progress}%</progress> : <><p role="alert">{job.error}</p><button type="button" disabled={busy} onClick={() => void upload(job)}>{t('board.retryUpload', 'Retry image upload')}</button><button type="button" disabled={busy} onClick={() => setUploads(previous => previous.filter(item => item.key !== job.key))}>{t('common.cancel', 'Cancel')}</button></>}</div>)}
    {error && <p role="alert">{error}</p>}
  </fieldset>
}
