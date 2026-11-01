import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inspectCloudConfiguration, inspectTestIdentities, loadCloudEnvironment, publicReport } from './cloud/config.mjs'
import { cloudProtocol, expectFailure, inspectRemote } from './cloud/protocol.mjs'
import { runGuardedCodegen } from './cloud-preflight.mjs'
import { runCloudSmoke, smokePng } from './cloud/smoke.mjs'

const environment = () => ({ VITE_CONVEX_URL: 'https://leather-test.convex.cloud', VITE_OIDC_AUTHORITY: 'https://identity.test', VITE_OIDC_CLIENT_ID: 'fixtureClientId123', LEATHERCAD_CLOUD_EDITOR_URL: 'https://editor.test/LeatherCad/', VITE_BASE_PATH: '/LeatherCad/', CONVEX_DEPLOYMENT: 'dev:leather-test', CONVEX_DEPLOY_KEY: 'dev:leather-test|never-print-this-key', AUTH_JWT_ISSUER: 'https://identity.test', AUTH_JWT_AUDIENCE: 'fixtureClientId123' })
const config = () => inspectCloudConfiguration(environment(), { credentialFilePresent: false })
const token = subject => `${Buffer.from('{"alg":"test-fixture-only"}').toString('base64url')}.${Buffer.from(JSON.stringify({ iss: 'https://identity.test', aud: 'fixtureClientId123', sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`
const json = value => new Response(JSON.stringify({ status: 'success', value }), { headers: { 'Content-Type': 'application/json' } })
const rejected = message => new Response(JSON.stringify({ status: 'error', errorMessage: message }))

test('preflight reports missing setup without discovering or printing credentials', () => {
  const result = inspectCloudConfiguration({}, { credentialFilePresent: false })
  assert.equal(result.status, 'blocked')
  assert.equal(result.credentialPresence.deployKey, false)
  assert.ok(result.checks.some(check => check.name === 'oidc-authority' && check.status === 'blocked'))
  const valid = publicReport(config())
  assert.equal(valid.publicConfiguration.callback, 'https://editor.test/LeatherCad/?lcad-oidc=callback')
  assert.equal(JSON.stringify(valid).includes('never-print-this-key'), false)
  assert.equal(JSON.stringify(valid).includes('fixtureClientId123'), false)
})
test('environment files follow mode precedence while process environment wins', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'leathercad-cloud-config-'))
  try {
    fs.writeFileSync(path.join(directory, '.env'), 'VITE_OIDC_CLIENT_ID=base\nCONVEX_DEPLOY_KEY=private-value\n')
    fs.writeFileSync(path.join(directory, '.env.production'), 'VITE_OIDC_CLIENT_ID=production\n')
    fs.writeFileSync(path.join(directory, '.env.production.local'), 'VITE_OIDC_CLIENT_ID=local\n')
    const result = loadCloudEnvironment({ directory, mode: 'production', environment: { VITE_OIDC_CLIENT_ID: 'process' } })
    assert.equal(result.environment.VITE_OIDC_CLIENT_ID, 'process')
    assert.equal(result.sources.length, 3)
    assert.equal(JSON.stringify(publicReport(inspectCloudConfiguration(result.environment, { credentialFilePresent: false }))).includes('private-value'), false)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
test('target, callback, audience, and HTTPS mismatches block the configuration', () => {
  for (const changes of [{ CONVEX_DEPLOYMENT: 'dev:other-target' }, { LEATHERCAD_CLOUD_EDITOR_URL: 'https://editor.test/wrong/' }, { AUTH_JWT_AUDIENCE: 'different-client' }, { VITE_CONVEX_URL: 'http://remote.test' }, { VITE_CONVEX_URL: 'https://user:secret@leather-test.convex.cloud' }]) assert.equal(inspectCloudConfiguration({ ...environment(), ...changes }, { credentialFilePresent: false }).status, 'blocked')
})
test('codegen guard never creates a project, deploys, logs in or leaks child output', async () => {
  const calls = []
  const execute = async (...args) => { calls.push(args); return { code: 0, outputBytes: 100 } }
  assert.equal((await runGuardedCodegen(inspectCloudConfiguration({}, { credentialFilePresent: false }), {}, { execute })).status, 'blocked')
  assert.equal(calls.length, 0)
  assert.equal((await runGuardedCodegen(config(), { ...environment(), CONVEX_DEPLOY_KEY: 'prod:other|secret' }, { execute })).status, 'blocked')
  assert.equal(calls.length, 0)
  const result = await runGuardedCodegen(config(), environment(), { directory: '/test/project', execute })
  assert.equal(result.status, 'pass')
  assert.deepEqual(calls[0][1].slice(1), ['codegen', '--typecheck', 'enable'])
  assert.equal(calls[0][2].env.CI, '1')
  assert.equal(JSON.stringify(result).includes('secret'), false)
})
test('test identity decoding is a routing guard and requires distinct live application claims', () => {
  assert.doesNotThrow(() => inspectTestIdentities(token('a'), token('b'), { issuer: 'https://identity.test', clientId: 'fixtureClientId123' }))
  assert.throws(() => inspectTestIdentities(token('a'), token('a')), /distinct/)
  assert.throws(() => inspectTestIdentities(token('a'), token('b'), { clientId: 'wrong' }), /current application/)
})
test('anonymous authorization denial cannot be confused with a missing function or server error', async () => {
  const call = cloudProtocol('https://leather-test.convex.cloud', null, async () => rejected('Function not found'))
  await assert.rejects(() => expectFailure(() => call('query', 'cloudLifecycle:list', {}), 'authorization-denied'), /cloud-function-failed/)
  const unavailable = cloudProtocol('https://leather-test.convex.cloud', null, async () => new Response(JSON.stringify({ status: 'error', errorMessage: 'Sign in service unavailable' }), { status: 503 }))
  await assert.rejects(() => expectFailure(() => unavailable('query', 'cloudLifecycle:list', {}), 'authorization-denied'), /cloud-function-failed/)
  const denied = cloudProtocol('https://leather-test.convex.cloud', null, async () => rejected('Sign in to access your cloud library'))
  await expectFailure(() => denied('query', 'cloudLifecycle:list', {}), 'authorization-denied')
})
test('remote preflight checks discovery, public reads, private denial and upload CORS without tokens', async () => {
  const requests = []
  const checks = await inspectRemote(config(), { fetcher: async (url, options) => {
    requests.push({ url, options })
    if (url.includes('.well-known')) return new Response(JSON.stringify({ issuer: 'https://identity.test', authorization_endpoint: 'https://identity.test/authorize', token_endpoint: 'https://identity.test/token', jwks_uri: 'https://identity.test/jwks', response_types_supported: ['code'], code_challenge_methods_supported: ['S256'] }))
    if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } })
    const request = JSON.parse(options.body)
    return request.path === 'cloudLifecycle:list' ? rejected('Sign in') : json({ page: [], isDone: true, continueCursor: '' })
  } })
  assert.equal(checks.length, 5)
  assert.ok(checks.every(check => check.status === 'pass'))
  assert.ok(requests.every(request => !request.options.headers?.Authorization))
})
function simulatedDeployment({ failPurge = false } = {}) {
  const documents = new Map(), assets = new Map(), topics = new Map(), patterns = new Map(), calls = []
  let nextId = 0
  const fetcher = async (url, options) => {
    const auth = options.headers?.Authorization
    // Compare stable subjects rather than regeneration timing in token helpers.
    const owner = auth ? JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url')).sub : null
    calls.push({ url, method: options.method, actor: owner })
    if (url.endsWith('/cloud-assets/upload')) { const asset = assets.get(options.headers['X-LeatherCad-Asset']); assert.equal(asset.owner, owner); asset.ready = true; asset.bytes = options.body; return json({ id: asset.id }) }
    if (url.includes('/storage/')) return new Response(assets.get(url.split('/').at(-1)).bytes)
    const request = JSON.parse(options.body), args = request.args, fn = request.path
    const key = id => `${owner}:${id}`
    if (fn === 'community:listPublic') return json({ page: [], isDone: true, continueCursor: '' })
    if (fn === 'cloudLifecycle:list' && !owner) return rejected('Sign in')
    if (!owner && !['community:get', 'cloudAssets:resolve', 'communityBoard:getTopic'].includes(fn)) return rejected('Sign in')
    if (fn === 'cloudQuota:status') return json({ bytes: 0, drawings: 0, ready: true, maximumBytes: 1, maximumDrawings: 1 })
    if (fn === 'cloudDocuments:create') { const value = { ...args, revision: 1 }; documents.set(key(args.id), value); return json(value) }
    if (fn === 'cloudDocuments:get') { const value = documents.get(key(args.id)); return json(value?.deleted ? null : value ?? null) }
    if (fn === 'cloudWorkspace:readRevision') return json(null)
    if (fn === 'cloudDocuments:save') { const row = documents.get(key(args.id)); if (row.revision !== args.expectedRevision) return rejected('Cloud drawing changed'); Object.assign(row, args, { revision: row.revision + 1 }); return json(row) }
    if (fn === 'cloudDocuments:remove') { const row = documents.get(key(args.id)); assert.equal(row.revision, args.expectedRevision); row.deleted = true; row.revision++; return json(null) }
    if (fn === 'cloudQuota:purge') { if (failPurge) return rejected('Maintenance unavailable'); documents.delete(key(args.id)); return json(null) }
    if (fn === 'cloudWorkspace:listHistory') return json({ page: documents.has(key(args.id)) ? [{ revision: 1 }] : [], isDone: true, continueCursor: '' })
    if (fn === 'cloudAssets:beginUpload') { const id = `asset-${++nextId}`; assets.set(id, { ...args, id, owner }); return json({ id, uploadUrl: 'https://leather-test.convex.site/cloud-assets/upload' }) }
    if (fn === 'cloudAssets:resolve') { const asset = assets.get(args.id); return json(asset?.owner === owner ? { size: asset.size, sha256: asset.sha256, contentType: asset.contentType, url: `https://leather-test.convex.cloud/storage/${asset.id}` } : null) }
    if (fn === 'cloudAssets:remove') { assets.delete(args.id); return json(null) }
    if (fn === 'communityBoard:createTopic') { const value = { ...args, id: `topic-${++nextId}`, owner, revision: 1 }; topics.set(value.id, value); return json(value) }
    if (fn === 'communityBoard:getTopic') { const value = topics.get(args.id); return json(value?.owner === owner ? value : null) }
    if (fn === 'communityBoard:removeTopic') { topics.delete(args.id); return json(null) }
    if (fn === 'community:publish') { const old = patterns.get(args.id), value = { ...args, id: old?.id ?? `pattern-${++nextId}`, version: old ? 2 : 1, visibilityRevision: old ? 2 : 1 }; patterns.set(value.id, value); return json(value) }
    if (fn === 'community:get') { const value = patterns.get(args.id); return json(args.version === 2 ? value : null) }
    if (fn === 'community:retire') { patterns.get(args.id).retired = true; return json(null) }
    throw new Error(`Unexpected test request ${fn} for the test actor`)
  }
  return { fetcher, calls, documents, assets, topics, patterns }
}
test('read-only smoke verifies both account tokens without mutations', async () => {
  const service = simulatedDeployment()
  const report = await runCloudSmoke(config(), { tokenA: token('a'), tokenB: token('b'), fetcher: service.fetcher })
  assert.equal(report.status, 'read-only-pass')
  assert.equal(service.documents.size, 0)
  assert.ok(service.calls.every(call => call.url.endsWith('/api/query')))
  assert.equal(JSON.stringify(report).includes(token('a')), false)
})
test('explicit write smoke tests isolation/revisions/history/upload and cleans only unique markers', async () => {
  const service = simulatedDeployment()
  const report = await runCloudSmoke(config(), { tokenA: token('a'), tokenB: token('b'), write: true, runId: 'leathercad-cloud-smoke-fixture', fetcher: service.fetcher, poll: async () => undefined })
  assert.equal(report.status, 'write-smoke-pass')
  assert.ok(report.checks.every(check => check.status === 'pass'))
  assert.ok(report.cleanup.every(check => check.status === 'pass'))
  assert.equal(service.documents.size, 0)
  assert.equal(service.assets.size, 0)
  assert.equal(service.topics.size, 0)
  assert.equal([...service.patterns.values()][0].retired, true)
  assert.equal(report.remainingMetadata.length, 2)
  assert.equal(JSON.stringify(report).includes(token('a')), false)
})
test('cleanup failures cannot be reported as a completed successful smoke', async () => {
  const service = simulatedDeployment({ failPurge: true })
  const report = await runCloudSmoke(config(), { tokenA: token('a'), tokenB: token('b'), write: true, fetcher: service.fetcher, poll: async () => undefined })
  assert.equal(report.status, 'cleanup-incomplete')
  assert.equal(report.recovery.documentIds.length, 2)
})
test('each run uses a distinct valid PNG fixture to avoid removing an unrelated deduplicated asset', () => {
  const a = smokePng('one'), b = smokePng('two')
  assert.deepEqual([...a.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.notEqual(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'))
  assert.equal(a.subarray(-8, -4).toString(), 'IEND')
})
