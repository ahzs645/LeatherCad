import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const DEFAULT_TS_MAX = 700
const DEFAULT_SCSS_MAX = 700

const trackedDebt = new Map([
  ['src/features/editor/useEditorScreenController.ts', { max: 2038, target: 600 }],
])

const modulePolicies = {
  canvas: {
    blockedEditorSegments: ['components', 'workbench'],
  },
  topbar: {
    blockedEditorSegments: ['cad', 'components', 'hooks', 'ops', 'state', 'workbench'],
  },
}

function collectFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, result)
    } else {
      result.push(fullPath)
    }
  }
  return result
}

function toRepoPath(fullPath) {
  return path.relative(ROOT, fullPath).split(path.sep).join('/')
}

function lineCount(fullPath) {
  const text = fs.readFileSync(fullPath, 'utf8')
  return text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0)
}

function isAppSourceFile(repoPath) {
  if (!/\.(ts|tsx|scss)$/.test(repoPath)) return false
  if (repoPath.includes('.test.') || repoPath.includes('.spec.')) return false
  if (repoPath.endsWith('.d.ts')) return false
  return true
}

function checkFileSizes(files) {
  const failures = []
  const debtNotes = []

  for (const fullPath of files) {
    const repoPath = toRepoPath(fullPath)
    if (!isAppSourceFile(repoPath)) continue

    const count = lineCount(fullPath)
    const debt = trackedDebt.get(repoPath)
    const limit = debt?.max ?? (repoPath.endsWith('.scss') ? DEFAULT_SCSS_MAX : DEFAULT_TS_MAX)

    if (count > limit) {
      failures.push(`${repoPath}: ${count} lines exceeds limit ${limit}`)
    }

    if (debt && count > debt.target) {
      debtNotes.push(`${repoPath}: ${count} lines, target ${debt.target}`)
    }
  }

  return { failures, debtNotes }
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const sourceDir = path.dirname(fromFile)
  return path.normalize(path.join(sourceDir, specifier)).split(path.sep).join('/')
}

function checkModuleBoundaries(files) {
  const failures = []

  for (const fullPath of files) {
    const repoPath = toRepoPath(fullPath)
    const match = repoPath.match(/^src\/features\/editor\/modules\/([^/]+)\/.+\.(ts|tsx)$/)
    if (!match) continue

    const moduleName = match[1]
    const policy = modulePolicies[moduleName]
    if (!policy) continue

    const source = fs.readFileSync(fullPath, 'utf8')
    const imports = source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)
    for (const [, specifier] of imports) {
      const resolved = resolveRelativeImport(repoPath, specifier)
      if (!resolved) continue

      const siblingModuleMatch = resolved.match(/^src\/features\/editor\/modules\/([^/]+)\//)
      if (siblingModuleMatch && siblingModuleMatch[1] !== moduleName) {
        failures.push(`${repoPath}: import sibling module through its public API, not ${specifier}`)
      }

      const editorSegmentMatch = resolved.match(/^src\/features\/editor\/([^/]+)\//)
      const editorSegment = editorSegmentMatch?.[1]
      if (editorSegment && policy.blockedEditorSegments.includes(editorSegment)) {
        failures.push(`${repoPath}: ${moduleName} module may not import editor/${editorSegment} via ${specifier}`)
      }
    }
  }

  return failures
}

const files = collectFiles(SRC_DIR)
const { failures: sizeFailures, debtNotes } = checkFileSizes(files)
const boundaryFailures = checkModuleBoundaries(files)
const failures = [...sizeFailures, ...boundaryFailures]

if (debtNotes.length > 0) {
  console.log('Tracked architecture debt still above target:')
  for (const note of debtNotes) {
    console.log(`- ${note}`)
  }
}

if (failures.length > 0) {
  console.error('Architecture check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Architecture check passed.')
