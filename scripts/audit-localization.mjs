import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const argument = process.argv.indexOf('--out')
const outputPath = argument >= 0 ? path.resolve(root, process.argv[argument + 1] ?? '') : null
if (argument >= 0 && !process.argv[argument + 1]) throw new Error('--out requires a file path')

async function filesWithin(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map(entry => {
    const name = path.join(directory, entry.name)
    return entry.isDirectory() ? filesWithin(name) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [name] : []
  }))
  return groups.flat().sort()
}
function workflow(file) {
  if (/NativeCurve|ShapeAppearance/.test(file)) return 'geometry-inspector'
  if (/OptionsModal|OptionsNavigation|InterfacePreferencesPanel|LengthInput/.test(file)) return 'options'
  if (/ChangeShapeSize|MandalaModal|request-even-stitch/.test(file)) return 'geometry-dialogs'
  if (/Cloud|Community|Library/.test(file)) return 'cloud-community'
  if (/Stl|Dxf|Export|Import|TransferReview/.test(file)) return 'interchange-manufacturing'
  return 'shell-and-other'
}
function literals(node) {
  if (!node) return []
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)]
  if (ts.isParenthesizedExpression(node)) return literals(node.expression)
  return []
}

const records = new Map()
const dynamicCalls = []
const files = await filesWithin(path.join(root, 'src/features/editor'))
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join('/')
  const source = await fs.readFile(file, 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const translationFile = /useTranslate|translateUiText/.test(source)
  const registryFile = /editor-constants\.ts$|workbench-models\.ts$|WorkbenchHeader\.tsx$|workspace-presets\.ts$|OptionsNavigation\.tsx$/.test(file)
  function add(key, fallback, node, kind) {
    const location = `${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`
    const record = records.get(key) ?? { key, fallbacks: new Set(), locations: new Set(), workflows: new Set(), kinds: new Set() }
    record.fallbacks.add(fallback ?? key); record.locations.add(location); record.workflows.add(workflow(relative)); record.kinds.add(kind)
    records.set(key, record)
  }
  function visit(node) {
    if (translationFile && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const keys = literals(node.arguments[0])
      const fallback = literals(node.arguments[1])[0]
      for (const key of keys) add(key, fallback ?? key, node, 'translation-call')
      if (!keys.length) dynamicCalls.push({ location: `${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`, expression: node.arguments[0]?.getText(tree).slice(0, 160) ?? '', workflow: workflow(relative) })
    }
    if (registryFile && ts.isPropertyAssignment(node) && ['label', 'title'].includes(node.name.getText(tree).replace(/['"]/g, ''))) {
      for (const key of literals(node.initializer)) add(key, key, node, 'label-registry')
    }
    if (/OptionsNavigation\.tsx$/.test(file) && ts.isArrayLiteralExpression(node) && node.elements.length === 2 && node.elements.every(ts.isStringLiteralLike)) {
      add(node.elements[1].text, node.elements[1].text, node, 'category-registry')
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
}

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'leathercad-locales-'))
try {
  for (const name of ['locale-ja-options', 'locale-ja-interface', 'locale-interface-shell', 'locale-shell-dictionaries', 'locale-dictionaries']) {
    const source = await fs.readFile(path.join(root, `src/features/editor/ops/${name}.ts`), 'utf8')
    const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from (['"])(\.\/[^'"]+)\1/g, (_match, quote, specifier) => `from ${quote}${specifier}.mjs${quote}`)
    await fs.writeFile(path.join(temporary, `${name}.mjs`), javascript)
  }
  const { EDITOR_LANGUAGES, getBuiltinTranslation, getLocaleCoverage } = await import(pathToFileURL(path.join(temporary, 'locale-dictionaries.mjs')).href)
  const { SHELL_TRANSLATION_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-shell-dictionaries.mjs')).href)
  const { INTERFACE_SHELL_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-interface-shell.mjs')).href)
  const inventory = [...records.values()].sort((a, b) => a.key.localeCompare(b.key)).map(record => ({ ...record, fallbacks: [...record.fallbacks].sort(), locations: [...record.locations].sort(), workflows: [...record.workflows].sort(), kinds: [...record.kinds].sort() }))
  const resolves = (locale, record) => locale === 'en' || getBuiltinTranslation(locale, record.key) !== undefined || record.fallbacks.some(fallback => getBuiltinTranslation(locale, fallback) !== undefined)
  const locales = EDITOR_LANGUAGES.map(({ locale, label }) => {
    const missing = inventory.filter(record => !resolves(locale, record))
    const byWorkflow = Object.fromEntries([...new Set(inventory.flatMap(record => record.workflows))].sort().map(name => {
      const used = inventory.filter(record => record.workflows.includes(name))
      return [name, { usedKeys: used.length, resolvedKeys: used.filter(record => resolves(locale, record)).length }]
    }))
    const missingCoreKeys = locale === 'en' ? [] : [...SHELL_TRANSLATION_KEYS, ...INTERFACE_SHELL_KEYS].filter(key => getBuiltinTranslation(locale, key) === undefined)
    return { locale, label, dictionaryEntries: getLocaleCoverage(locale).translatedEntryCount, usedKeys: inventory.length, resolvedKeys: inventory.length - missing.length, missingKeys: missing.map(record => record.key), missingCoreKeys, byWorkflow }
  })
  const missingKeySets = {}
  const setSignatures = new Map()
  const compactLocales = locales.map(({ missingKeys, ...locale }) => {
    const signature = JSON.stringify(missingKeys)
    let id = setSignatures.get(signature)
    if (!id) { id = `missing-${setSignatures.size}`; setSignatures.set(signature, id); missingKeySets[id] = missingKeys }
    return { ...locale, missingKeyCount: missingKeys.length, missingKeySet: id }
  })
  const report = {
    schemaVersion: 1,
    methodology: 'Static t() literal/conditional keys plus known tool/ribbon/settings-label registries. Runtime key expressions are listed for manual review. Unwired application copy, user-generated labels and imported translation overrides are outside this inventory. Resolved means a built-in key or English-fallback alias exists; this does not assess translation quality or complete product coverage.',
    sourceFiles: files.length, usedKeys: inventory.length, dynamicCalls, missingKeySets, locales: compactLocales, inventory,
  }
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify({ output: path.relative(root, outputPath), sourceFiles: files.length, usedKeys: inventory.length, dynamicCalls: dynamicCalls.length, locales: locales.map(({ locale, dictionaryEntries, resolvedKeys, missingCoreKeys }) => ({ locale, dictionaryEntries, resolvedKeys, missingCoreKeys })) }, null, 2))
  } else console.log(JSON.stringify(report, null, 2))
  if (process.argv.includes('--check-core') && locales.some(locale => locale.missingCoreKeys.length)) process.exitCode = 1
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
