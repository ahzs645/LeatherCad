import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pair = JSON.parse(fs.readFileSync(path.join(root, 'engine-pair.json'), 'utf8'))
const engine = path.resolve(root, '../atelier')
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(pair.revision)) throw new Error('engine-pair.json must pin a full Git revision.')
const actual = git(engine, 'rev-parse', 'HEAD')
if (actual !== pair.revision) throw new Error(`Atelier revision mismatch: expected ${pair.revision}, found ${actual}. Follow docs/RELEASE_VERIFICATION.md to update the pair.`)
if (git(engine, 'status', '--porcelain', '--untracked-files=no')) throw new Error('Atelier has tracked modifications. Validate a clean pinned engine before building a release.')
const appPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
for (const [name, version] of Object.entries(appPackage.dependencies)) {
  if (name.startsWith('@atelier/') && version !== `link:../atelier/packages/${name.slice(9)}`) throw new Error(`Unexpected engine source mapping for ${name}.`)
}
for (const name of ['ci.yml', 'github-pages.yml', 'release-verification.yml']) {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8')
  if (!workflow.includes(`ref: ${pair.revision}`)) throw new Error(`${name} does not use the pinned engine revision.`)
}
if (process.argv.includes('--write')) {
  const output = path.join(root, 'dist')
  if (!fs.existsSync(output)) throw new Error('Build dist before writing release provenance.')
  fs.writeFileSync(path.join(output, 'release-pair.json'), JSON.stringify({
    version: 1, appRevision: git(root, 'rev-parse', 'HEAD'),
    appWorkingTreeModified: Boolean(git(root, 'status', '--porcelain', '--untracked-files=normal')),
    engineRepository: pair.repository, engineRevision: actual,
    nodeVersion: process.version, packageManager: appPackage.packageManager,
  }, null, 2) + '\n')
}
console.log(`Verified Atelier ${actual}`)
