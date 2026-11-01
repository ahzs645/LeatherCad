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
  if (/DraftRecoveryDialog|draft-recovery|useDraftRecovery/.test(file)) return 'draft-recovery'
  if (/PrintPreviewModal/.test(file)) return 'print-preview'
  if (/StlExportModal|StlManufacturingControls|StlCalibrationDownload|useStlGeneration|printer-calibration/.test(file)) return 'manufacturing'
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
const unwiredCopy = []
const files = await filesWithin(path.join(root, 'src/features/editor'))
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join('/')
  const source = await fs.readFile(file, 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const translationFile = /useTranslate|translateUiText/.test(source)
  const registryFile = /editor-constants\.ts$|workbench-models\.ts$|WorkbenchHeader\.tsx$|workspace-presets\.ts$|OptionsNavigation\.tsx$/.test(file)
  function add(key, fallback, node, kind) {
    if (!key.trim()) return
    const location = `${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`
    const record = records.get(key) ?? { key, fallbacks: new Set(), locations: new Set(), workflows: new Set(), kinds: new Set() }
    record.fallbacks.add(fallback ?? key); record.locations.add(location); record.workflows.add(workflow(relative)); record.kinds.add(kind)
    records.set(key, record)
  }
  function visit(node) {
    const candidate = ts.isJsxText(node) ? node.text.trim().replace(/\s+/g, ' ') : ts.isJsxAttribute(node) && ['aria-label', 'title', 'placeholder'].includes(node.name.getText(tree)) && node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.text : ''
    if (candidate && /[A-Za-z]/.test(candidate) && !/^(?:mm|cm|in|px|DPI|STL|SVG|DXF|PDF|X|Y)$/i.test(candidate)) {
      unwiredCopy.push({ location: `${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`, workflow: workflow(relative), text: candidate })
    }
    if (translationFile && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const keys = literals(node.arguments[0])
      const fallback = literals(node.arguments[1])[0]
      for (const key of keys) add(key, fallback ?? key, node, 'translation-call')
      if (!keys.length) dynamicCalls.push({ location: `${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`, expression: node.arguments[0]?.getText(tree).slice(0, 160) ?? '', workflow: workflow(relative) })
    }
    if (registryFile && ts.isPropertyAssignment(node) && ['label', 'title'].includes(node.name.getText(tree).replace(/['"]/g, ''))) {
      for (const key of literals(node.initializer)) add(key, key, node, 'label-registry')
    }
    if (/StlManufacturingControls\.tsx$/.test(file)) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'number') {
        for (const key of literals(node.arguments[1])) add(key, key, node, 'specialist-control-registry')
      }
      if (ts.isPropertyAssignment(node) && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.name.getText(tree) === 'MANUFACTURING_ROLE_LABELS') {
        for (const key of literals(node.initializer)) add(key, key, node, 'specialist-control-registry')
      }
    }
    if (/StlExportModal\.tsx$/.test(file) && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'setFontError') {
      for (const key of literals(node.arguments[0])) add(key, key, node, 'specialist-error-registry')
    }
    if (/StlCalibrationDownload\.tsx$/.test(file) && ts.isPropertyAssignment(node) && ts.isVariableDeclaration(node.parent.parent.parent) && node.parent.parent.parent.name.getText(tree) === 'CALIBRATION_ERRORS') {
      for (const key of literals(node.initializer)) add(key, key, node, 'specialist-error-registry')
    }
    if (/useStlGeneration\.ts$/.test(file)) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'finish') {
        for (const key of literals(node.arguments[1])) add(key, key, node, 'specialist-error-registry')
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'error') {
        for (const key of literals(node.initializer)) add(key, key, node, 'specialist-error-registry')
      }
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
  for (const name of ['locale-ja-options', 'locale-ja-interface', 'locale-ja-specialist', 'locale-interface-shell', 'locale-recovery', 'locale-specialist-controls', 'locale-native-editor', 'locale-shell-dictionaries', 'locale-dictionaries']) {
    const source = await fs.readFile(path.join(root, `src/features/editor/ops/${name}.ts`), 'utf8')
    const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from (['"])(\.\/[^'"]+)\1/g, (_match, quote, specifier) => `from ${quote}${specifier}.mjs${quote}`)
    await fs.writeFile(path.join(temporary, `${name}.mjs`), javascript)
  }
  const { EDITOR_LANGUAGES, getBuiltinTranslation, getLocaleCoverage } = await import(pathToFileURL(path.join(temporary, 'locale-dictionaries.mjs')).href)
  const { SHELL_TRANSLATION_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-shell-dictionaries.mjs')).href)
  const { INTERFACE_SHELL_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-interface-shell.mjs')).href)
  const { RECOVERY_ACTION_KEYS, RECOVERY_DECISION_KEY, RECOVERY_TRANSFER_KEY } = await import(pathToFileURL(path.join(temporary, 'locale-recovery.mjs')).href)
  const { SPECIALIST_CONTROL_KEYS, CALIBRATION_ACTION_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-specialist-controls.mjs')).href)
  const { NATIVE_EDITOR_KEYS, NATIVE_EDITOR_ALIASES, NATIVE_EDITOR_VALIDATION_KEYS } = await import(pathToFileURL(path.join(temporary, 'locale-native-editor.mjs')).href)
  const inventory = [...records.values()].sort((a, b) => a.key.localeCompare(b.key)).map(record => ({ ...record, fallbacks: [...record.fallbacks].sort(), locations: [...record.locations].sort(), workflows: [...record.workflows].sort(), kinds: [...record.kinds].sort() }))
  const resolves = (locale, record) => locale === 'en' || getBuiltinTranslation(locale, record.key) !== undefined || record.fallbacks.some(fallback => getBuiltinTranslation(locale, fallback) !== undefined)
  const locales = EDITOR_LANGUAGES.map(({ locale, label }) => {
    const missing = inventory.filter(record => !resolves(locale, record))
    const byWorkflow = Object.fromEntries([...new Set(inventory.flatMap(record => record.workflows))].sort().map(name => {
      const used = inventory.filter(record => record.workflows.includes(name))
      return [name, { usedKeys: used.length, resolvedKeys: used.filter(record => resolves(locale, record)).length }]
    }))
    const missingCoreKeys = locale === 'en' ? [] : [...SHELL_TRANSLATION_KEYS, ...INTERFACE_SHELL_KEYS, ...RECOVERY_ACTION_KEYS, RECOVERY_DECISION_KEY, RECOVERY_TRANSFER_KEY, ...SPECIALIST_CONTROL_KEYS, ...CALIBRATION_ACTION_KEYS, ...NATIVE_EDITOR_KEYS, ...Object.keys(NATIVE_EDITOR_ALIASES), ...NATIVE_EDITOR_VALIDATION_KEYS].filter(key => getBuiltinTranslation(locale, key) === undefined)
    return { locale, label, dictionaryEntries: getLocaleCoverage(locale).translatedEntryCount, usedKeys: inventory.length, resolvedKeys: inventory.length - missing.length, missingKeys: missing.map(record => record.key), missingCoreKeys, byWorkflow }
  })
  const placeholders = value => [...value.matchAll(/\{[A-Za-z][A-Za-z0-9_]*\}/g)].map(match => match[0]).sort().join(',')
  const placeholderErrors = []
  for (const { locale } of EDITOR_LANGUAGES.filter(language => language.locale !== 'en')) {
    for (const record of inventory) {
      const translated = getBuiltinTranslation(locale, record.key) ?? record.fallbacks.map(fallback => getBuiltinTranslation(locale, fallback)).find(value => value !== undefined)
      if (translated !== undefined && !record.fallbacks.some(fallback => placeholders(fallback) === placeholders(translated))) {
        placeholderErrors.push({ locale, key: record.key, expected: record.fallbacks.map(placeholders), actual: placeholders(translated) })
      }
    }
  }
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
    methodology: 'Static t() literal/conditional keys plus known tool/ribbon/settings/manufacturing label and application-owned error registries. Runtime key expressions and candidate unwired JSX/attribute copy are listed for manual review. User-generated labels, generated measurement-checklist text and imported translation overrides are outside this inventory. Resolved means a built-in key or English-fallback alias exists; this does not assess translation quality or complete product coverage.',
    sourceFiles: files.length, usedKeys: inventory.length, dynamicCalls, unwiredCopy, placeholderErrors, missingKeySets, locales: compactLocales, inventory,
  }
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify({ output: path.relative(root, outputPath), sourceFiles: files.length, usedKeys: inventory.length, dynamicCalls: dynamicCalls.length, unwiredCandidates: unwiredCopy.length, placeholderErrors, locales: locales.map(({ locale, dictionaryEntries, resolvedKeys, missingCoreKeys }) => ({ locale, dictionaryEntries, resolvedKeys, missingCoreKeys })) }, null, 2))
  } else console.log(JSON.stringify(report, null, 2))
  if (process.argv.includes('--check-core') && (locales.some(locale => locale.missingCoreKeys.length) || placeholderErrors.length)) process.exitCode = 1
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
