import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { inspectCloudConfiguration, loadCloudEnvironment, publicReport } from './cloud/config.mjs'
import { inspectRemote } from './cloud/protocol.mjs'

export async function runGuardedCodegen(configuration, environment, { directory = process.cwd(), execute } = {}) {
  if (!configuration.values.api || !configuration.values.deployment || !configuration.cliAuth) return { status: 'blocked', reason: 'Codegen needs an explicit existing deployment matching the API origin and configured CLI authorization' }
  if (environment.CONVEX_AGENT_MODE === 'anonymous') return { status: 'blocked', reason: 'Anonymous project setup is disabled; use the selected existing deployment' }
  const keySelector = environment.CONVEX_DEPLOY_KEY?.match(/^(dev|prod|preview):([^|]+)\|/)
  if (keySelector && `${keySelector[1]}:${keySelector[2]}` !== configuration.values.deployment) return { status: 'blocked', reason: 'Deployment authorization does not match the explicitly selected target' }
  const args = [path.join(directory, 'node_modules/convex/bin/main.js'), 'codegen', '--typecheck', 'enable']
  const run = execute ?? ((command, commandArgs, options) => new Promise(resolve => {
    const child = spawn(command, commandArgs, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    // Never forward CLI output: errors can echo environment/configuration values.
    let outputBytes = 0
    const count = chunk => { outputBytes += chunk.length }
    child.stdout.on('data', count); child.stderr.on('data', count)
    child.on('error', () => resolve({ code: -1, outputBytes }))
    child.on('close', code => resolve({ code, outputBytes }))
  }))
  const result = await run(process.execPath, args, { cwd: directory, env: { ...environment, CI: '1' }, timeout: 120000 })
  return { status: result.code === 0 ? 'pass' : 'fail', exitCode: result.code, operation: 'local-code-generation-only', reason: result.code === 0 ? 'Deployment-generated local types were regenerated; this command does not deploy backend code' : 'Codegen failed without exposing CLI output; verify target authorization and run the standard CLI locally to inspect its diagnostics' }
}
export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { mode: { type: 'string', default: 'development' }, 'env-file': { type: 'string', multiple: true }, out: { type: 'string' }, remote: { type: 'boolean' }, codegen: { type: 'boolean' }, help: { type: 'boolean' } } })
  if (values.help) { console.log('Usage: node scripts/cloud-preflight.mjs [--mode development|production] [--env-file path] [--remote] [--codegen] [--out report.json]\nChecks configuration without printing credentials. --remote makes read-only discovery/anonymous requests. --codegen changes local generated types only, after an existing-target/auth guard. No project creation, login or deployment.'); return 0 }
  const loaded = loadCloudEnvironment({ mode: values.mode, files: values['env-file'] })
  const configuration = inspectCloudConfiguration(loaded.environment)
  const report = { ...publicReport(configuration), checkedAt: new Date().toISOString(), environmentFiles: loaded.sources, limitations: ['Local declarations do not prove remote backend environment or OIDC client registration', 'Live issuer signature verification and two-account isolation require configured account tokens and cloud-smoke', 'No deployment, project creation or interactive login is performed'] }
  if (values.remote) {
    report.remoteChecks = await inspectRemote(configuration)
    if (report.remoteChecks.some(check => check.status === 'fail')) report.status = 'remote-check-failed'
  }
  if (values.codegen) { report.codegen = await runGuardedCodegen(configuration, loaded.environment); if (report.codegen.status !== 'pass') report.status = 'codegen-blocked-or-failed' }
  if (values.out) fs.writeFileSync(values.out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify(report, null, 2))
  return report.status === 'configured-not-live-verified' ? 0 : 2
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then(code => { process.exitCode = code }).catch(() => { console.error('Cloud preflight failed. Check the selected environment file and command options; no credential values were printed.'); process.exitCode = 2 })
