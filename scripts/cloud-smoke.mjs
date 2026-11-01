import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { inspectCloudConfiguration, loadCloudEnvironment, publicReport, readSmokeToken } from './cloud/config.mjs'
import { runCloudSmoke } from './cloud/smoke.mjs'

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { mode: { type: 'string', default: 'development' }, 'env-file': { type: 'string', multiple: true }, 'write-smoke': { type: 'boolean' }, 'expect-origin': { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/cloud-smoke.mjs [--mode development|production] [--env-file path] [--write-smoke --expect-origin https://selected.convex.cloud] [--out report.json]\nDefault is read-only. ID tokens come only from LEATHERCAD_CLOUD_SMOKE_TOKEN_A/B or _FILE settings. --write-smoke creates uniquely marked test documents, one private discussion draft and temporary public synthetic pattern versions, then purges/retires only those resources. Dedicated test accounts/deployment are required; minimal license/topic metadata remains. Never put tokens in CLI arguments.'); return 0 }
  const loaded = loadCloudEnvironment({ mode: values.mode, files: values['env-file'] })
  const configuration = inspectCloudConfiguration(loaded.environment)
  let report
  if (!configuration.values.api || (values['write-smoke'] && (!configuration.values.http || !configuration.values.authority || !configuration.values.clientId || values['expect-origin'] !== configuration.values.api))) report = { status: 'blocked', reason: !configuration.values.api ? 'Set VITE_CONVEX_URL to the existing deployment before making live calls' : 'For write smoke, configure the real API/HTTP/issuer/client and explicitly pin --expect-origin to VITE_CONVEX_URL', configuration: publicReport(configuration) }
  else report = await runCloudSmoke(configuration, { tokenA: readSmokeToken(loaded.environment, 'A'), tokenB: readSmokeToken(loaded.environment, 'B'), write: Boolean(values['write-smoke']) })
  report.checkedAt = new Date().toISOString()
  if (values.out) fs.writeFileSync(values.out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify(report, null, 2))
  return ['read-only-pass', 'write-smoke-pass'].includes(report.status) ? 0 : 2
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then(code => { process.exitCode = code }).catch(() => { console.error('Cloud smoke could not start. Check environment settings/token files; credential and provider error details are suppressed.'); process.exitCode = 2 })
