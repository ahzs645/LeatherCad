import { createHash, randomUUID } from 'node:crypto'
import { cloudProtocol, assertCheck, expectFailure, CloudCheckError } from './protocol.mjs'
import { inspectTestIdentities } from './config.mjs'

const basePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aO0AAAAASUVORK5CYII=', 'base64')
export function smokePng(marker) {
  const type = Buffer.from('tEXt'), data = Buffer.from(`LeatherCadSmoke\0${marker}`, 'utf8')
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  let crc = 0xffffffff
  for (const byte of Buffer.concat([type, data])) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([basePng.subarray(0, -12), length, type, data, checksum, basePng.subarray(-12)])
}
const drawing = (marker, assetId) => ({ version: 1, units: 'mm', documentName: marker, objects: [{ id: 'edge', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], ...(assetId ? { tracingOverlays: [{ id: 'smoke-image', name: 'Synthetic smoke image', kind: 'image', sourceUrl: `lcad-asset:${assetId}`, visible: true, locked: false, opacity: 1, scale: 1, rotationDeg: 0, offsetX: 0, offsetY: 0, width: 1, height: 1 }] } : {}) })
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
export async function runCloudSmoke(configuration, { tokenA, tokenB, write = false, fetcher = fetch, poll = sleep, runId = `leathercad-cloud-smoke-${randomUUID()}` } = {}) {
  assertCheck(configuration.values.api, 'configure-VITE_CONVEX_URL')
  const report = { version: 1, runId, mode: write ? 'explicit-live-writes' : 'read-only', checks: [], cleanup: [], remainingMetadata: [] }
  const png = smokePng(runId)
  const anonymous = cloudProtocol(configuration.values.api, null, fetcher)
  const check = async (name, operation) => {
    try { const result = await operation(); report.checks.push({ name, status: 'pass' }); return result }
    catch (error) { report.checks.push({ name, status: 'fail', reason: error instanceof CloudCheckError ? error.code : 'check-failed' }); throw error }
  }
  const artifacts = { documentA: `${runId}-a`, documentB: `${runId}-b`, documentsCreated: [], pattern: null, asset: null, topic: null }
  let a, b
  try {
    await check('anonymous-gallery', async () => { const page = await anonymous('query', 'community:listPublic', { cursor: null }); assertCheck(Array.isArray(page?.page), 'invalid-gallery') })
    await check('anonymous-private-library-denied', () => expectFailure(() => anonymous('query', 'cloudLifecycle:list', { trash: false, cursor: null }), 'authorization-denied'))
    if (!tokenA || !tokenB) {
      report.status = write ? 'blocked' : 'anonymous-only'
      report.missing = ['Provide two distinct current application ID tokens through LEATHERCAD_CLOUD_SMOKE_TOKEN_A/B or their _FILE settings to verify authenticated isolation']
      return report
    }
    inspectTestIdentities(tokenA, tokenB, { issuer: configuration.values.authority, clientId: configuration.values.clientId })
    a = cloudProtocol(configuration.values.api, tokenA, fetcher); b = cloudProtocol(configuration.values.api, tokenB, fetcher)
    await check('account-a-verified-by-backend', () => a('query', 'cloudQuota:status', {}))
    await check('account-b-verified-by-backend', () => b('query', 'cloudQuota:status', {}))
    if (!write) { report.status = 'read-only-pass'; report.limitations = ['No records created: cross-account object isolation, stale writes and cleanup are not established by this read-only check']; return report }
    assertCheck(configuration.values.http, 'configure-trusted-http-origin')
    const docA = drawing(runId), docB = drawing(`${runId}-b`)
    await check('create-a-private-drawing', async () => { artifacts.documentsCreated.push({ actor: 'A', id: artifacts.documentA }); const value = await a('mutation', 'cloudDocuments:create', { id: artifacts.documentA, name: runId, docJson: JSON.stringify(docA) }); assertCheck(value.revision === 1, 'invalid-first-revision') })
    await check('create-b-private-drawing', async () => { artifacts.documentsCreated.push({ actor: 'B', id: artifacts.documentB }); const value = await b('mutation', 'cloudDocuments:create', { id: artifacts.documentB, name: `${runId}-b`, docJson: JSON.stringify(docB) }); assertCheck(value.revision === 1, 'invalid-first-revision') })
    await check('cross-account-drawings-hidden', async () => { assertCheck(await b('query', 'cloudDocuments:get', { id: artifacts.documentA }) === null, 'a-drawing-visible-to-b'); assertCheck(await a('query', 'cloudDocuments:get', { id: artifacts.documentB }) === null, 'b-drawing-visible-to-a') })
    await check('cross-account-history-hidden', async () => { assertCheck(await b('query', 'cloudWorkspace:readRevision', { id: artifacts.documentA, revision: 1 }) === null, 'a-history-visible-to-b') })
    await check('anonymous-document-denied', () => expectFailure(() => anonymous('query', 'cloudDocuments:get', { id: artifacts.documentA }), 'authorization-denied'))
    await check('authenticated-bounded-upload', async () => {
      const reservation = await a('mutation', 'cloudAssets:beginUpload', { name: `${runId}.png`, contentType: 'image/png', size: png.length, sha256: createHash('sha256').update(png).digest('hex') })
      artifacts.asset = reservation.id
      if (reservation.uploadUrl) {
        const url = new URL(reservation.uploadUrl)
        assertCheck(url.origin === configuration.values.http && url.pathname === '/cloud-assets/upload' && !url.search && !url.hash && !url.username && !url.password, 'untrusted-upload-endpoint')
        const response = await fetcher(url.href, { method: 'POST', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'image/png', 'X-LeatherCad-Asset': reservation.id }, body: png, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) })
        assertCheck(response.ok, 'bounded-upload-failed')
      }
      const asset = await a('query', 'cloudAssets:resolve', { id: reservation.id, patternId: null, version: null })
      assertCheck(asset?.size === png.length && asset.sha256 === createHash('sha256').update(png).digest('hex'), 'uploaded-asset-metadata-mismatch')
      const download = new URL(asset.url)
      assertCheck((download.protocol === 'https:' && (download.hostname.endsWith('.convex.cloud') || download.origin === configuration.values.api || download.origin === configuration.values.http)) || (download.protocol === 'http:' && download.origin === configuration.values.api), 'untrusted-storage-download-origin')
      const response = await fetcher(download.href, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) })
      assertCheck(response.ok && response.body, 'uploaded-asset-download-failed')
      const reader = response.body.getReader(), chunks = []; let size = 0
      try {
        for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; assertCheck(size <= png.length, 'uploaded-asset-download-too-large'); chunks.push(next.value) }
      } catch (error) { await reader.cancel().catch(() => undefined); throw error }
      assertCheck(size === png.length && createHash('sha256').update(Buffer.concat(chunks)).digest('hex') === asset.sha256, 'uploaded-asset-download-integrity-failed')
    })
    await check('private-assets-hidden', async () => { const args = { id: artifacts.asset, patternId: null, version: null }; assertCheck(await b('query', 'cloudAssets:resolve', args) === null, 'private-asset-visible-to-b'); assertCheck(await anonymous('query', 'cloudAssets:resolve', args) === null, 'private-asset-visible-anonymously') })
    const revised = drawing(`${runId}-updated`, artifacts.asset)
    await check('save-new-revision', async () => { const value = await a('mutation', 'cloudDocuments:save', { id: artifacts.documentA, name: runId, docJson: JSON.stringify(revised), expectedRevision: 1 }); assertCheck(value.revision === 2, 'invalid-second-revision') })
    await check('stale-save-rejected', () => expectFailure(() => a('mutation', 'cloudDocuments:save', { id: artifacts.documentA, name: runId, docJson: JSON.stringify(docA), expectedRevision: 1 }), 'revision-conflict'))
    await check('private-board-draft-hidden', async () => {
      const topic = await a('mutation', 'communityBoard:createTopic', { title: runId, body: 'Synthetic private deployment verification draft', status: 'draft', attachments: [artifacts.asset] })
      artifacts.topic = topic
      assertCheck(await b('query', 'communityBoard:getTopic', { id: topic.id }) === null, 'draft-visible-to-b')
      assertCheck(await anonymous('query', 'communityBoard:getTopic', { id: topic.id }) === null, 'draft-visible-anonymously')
    })
    await check('private-history-remains-private-after-public-version', async () => {
      const first = await a('mutation', 'community:publish', { id: null, expectedVersion: null, title: runId, description: 'Synthetic deployment verification only', attribution: 'LeatherCad deployment smoke fixture', license: 'CC0-1.0', visibility: 'private', docJson: JSON.stringify(revised) })
      artifacts.pattern = first
      const second = await a('mutation', 'community:publish', { id: first.id, expectedVersion: first.version, expectedVisibilityRevision: first.visibilityRevision, title: runId, description: 'Synthetic deployment verification only', attribution: 'LeatherCad deployment smoke fixture', license: 'CC0-1.0', visibility: 'public', docJson: JSON.stringify(drawing(`${runId}-public`)) })
      artifacts.pattern = second
      assertCheck(await anonymous('query', 'community:get', { id: first.id, version: 1 }) === null, 'private-historical-content-leaked')
      assertCheck((await anonymous('query', 'community:get', { id: first.id, version: 2 }))?.docJson.includes(`${runId}-public`), 'public-version-unavailable')
      assertCheck(await anonymous('query', 'cloudAssets:resolve', { id: artifacts.asset, patternId: first.id, version: 1 }) === null, 'private-historical-asset-leaked')
    })
    report.status = 'write-smoke-pass'
  } catch (error) {
    report.status = error instanceof CloudCheckError && /configure-|legacy-index/.test(error.code) ? 'blocked' : 'failed'
    report.failure = error instanceof CloudCheckError ? error.code : 'smoke-check-failed'
    if (write && error instanceof CloudCheckError && error.code === 'network-or-invalid-json') report.uncertainWrites = { marker: runId, action: 'A lost create response can leave a reservation/publication without a returned ID. Inspect only this marker in the dedicated test account and complete cleanup.' }
    if (!(error instanceof CloudCheckError)) report.action = 'Verify distinct current test account ID tokens and the configured issuer/client; raw token/provider errors are suppressed'
  } finally {
    if (write && a && b) {
      const cleanup = async (name, operation) => { try { await operation(); report.cleanup.push({ name, status: 'pass' }) } catch (error) { report.cleanup.push({ name, status: 'fail', reason: error instanceof CloudCheckError ? error.code : 'cleanup-failed' }) } }
      if (artifacts.topic) await cleanup('remove-smoke-private-draft', async () => { await a('mutation', 'communityBoard:removeTopic', { id: artifacts.topic.id, expectedRevision: artifacts.topic.revision }); report.remainingMetadata.push('A bounded removed-topic tombstone remains by design') })
      if (artifacts.pattern) await cleanup('retire-smoke-publication', async () => { await a('mutation', 'community:retire', { id: artifacts.pattern.id, expectedVersion: artifacts.pattern.version, expectedVisibilityRevision: artifacts.pattern.visibilityRevision }); report.remainingMetadata.push('Publication license/version metadata remains by design after payload retirement') })
      for (const item of artifacts.documentsCreated) await cleanup(`purge-smoke-drawing-${item.actor.toLowerCase()}`, async () => {
        const actor = item.actor === 'A' ? a : b, current = await actor('query', 'cloudDocuments:get', { id: item.id })
        if (!current) return
        assertCheck(current.id === item.id && current.name.startsWith(runId), 'cleanup-marker-mismatch')
        await actor('mutation', 'cloudDocuments:remove', { id: item.id, expectedRevision: current.revision })
        await actor('mutation', 'cloudQuota:purge', { id: item.id, expectedRevision: current.revision + 1 })
        let purged = false
        for (let attempt = 0; attempt < 20; attempt++) { const history = await actor('query', 'cloudWorkspace:listHistory', { id: item.id, cursor: null }); if (history.page?.length === 0) { purged = true; break }; await poll(500) }
        assertCheck(purged, 'purge-job-not-finished')
      })
      if (artifacts.asset) await cleanup('remove-smoke-asset-after-reference-cleanup', async () => {
        for (let attempt = 0; attempt < 20; attempt++) { try { await a('mutation', 'cloudAssets:remove', { id: artifacts.asset }); return } catch (error) { if (attempt === 19) throw error; await poll(500) } }
      })
      if (report.cleanup.some(item => item.status === 'fail')) { report.status = 'cleanup-incomplete'; report.recovery = { runId, documentIds: artifacts.documentsCreated.map(item => item.id), patternId: artifacts.pattern?.id ?? null, assetId: artifacts.asset, topicId: artifacts.topic?.id ?? null }; report.action = 'Use only these uniquely marked test resources to complete cleanup; never purge unrelated account content' }
    }
  }
  return report
}
