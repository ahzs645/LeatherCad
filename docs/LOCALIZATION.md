# Interface languages

Language switching is available in the workbench header, in the phone Options menu, and in the main Options dialog. It updates controls immediately, sets the document’s HTML language for assistive technology, and persists the choice in this browser. English is the default.

## Coverage

The catalog offers the same 20 languages as the reviewed reference app. Coverage is deliberately distinguished:

| Language | Bundled translation entries | Scope |
| --- | ---: | --- |
| English | Source text | Default interface and fallback |
| Japanese | 654 | Main workbench and phone controls, Options and new input/preset controls, size editing, export options, SVG import, stitch simulator, local projects, file tools, DXF units and STL controls |
| Armenian, Danish, German, Spanish, Finnish, French, Italian, Korean, Norwegian, Polish, Brazilian Portuguese, Portuguese, Romanian, Russian, Turkish, Ukrainian, Traditional Chinese, Simplified Chinese | 72 each | Main editing tabs, geometry tools, common file actions, core buttons, workspace views and file-tools aliases |

The 18 smaller dictionaries contain 48 shared editing actions, 12 equivalent labels/keys and 12 interface/native-geometry additions. They are working core translations, not complete translations of every inspector or advanced dialog. Japanese also retains English for remaining unwired specialist controls and technical diagnostics. New parser/mesh/cloud error details can remain English. Translation counts are entries, not the percentage of all application text.

`getLocaleCoverage` in `ops/locale-dictionaries.ts` exposes counts and scope from the actual dictionaries. Brazilian Portuguese uses `pt-BR`, Traditional Chinese uses `zh-TW`, and Simplified Chinese uses `zh-CN` so the HTML language is a valid locale tag.

Document names, user-supplied layer/piece labels, catalog contents and saved geometry are preserved. Changing the interface language does not translate or rewrite the drawing.

## Custom translations

Existing TSV and JSON translation imports continue to work. An imported value overrides the selected built-in language. Clearing custom translations restores that language; it does not force the interface back to English.

Supported examples:

```text
Save	保存する
Import DXF	DXF ファイルを読み込む
```

```json
{
  "Save": "保存する",
  "stl.download": "STL ファイルを保存"
}
```

For `t(key, englishFallback)`, lookup order is imported key, imported English fallback, built-in key, built-in English fallback, then unchanged English fallback. This permits stable semantic keys for new UI while retaining existing plain-label imports. Missing entries are never shown as fabricated translations.

## Adding translated UI

Call `useTranslate` in the component and translate application-owned copy, labels and accessibility text. Do not translate user data or operation identifiers. Keep command IDs and `data-testid` values stable.

```tsx
const t = useTranslate()
return <button>{t('stl.download', 'Download STL')}</button>
```

The hook uses browser preference/override stores and can render in reusable workbench components without requiring the editor’s document providers. Storage listeners are shared, snapshots are stable, and live imported overrides notify already-mounted consumers.

## Verification

`LanguageSelector.test.tsx` verifies actual header/ribbon switching, persistence, imported overrides, fallback, cross-tab updates, sample German/French/Chinese controls and complete core-key coverage for all selectable languages. Existing Workbench tests continue to run in English.

`e2e/localization.spec.ts` checks switching the real desktop interface to Japanese, reloading, changing to German, and using the phone Options language selector. The focused Chromium run passed both cases. More fluent-speaker review and deeper dictionary coverage remain useful follow-up work; this change does not claim complete localization of all 20 languages.

## Source-backed coverage audit

Run `node scripts/audit-localization.mjs --out docs/verification/localization-coverage.json --check-core` to regenerate the [used-key inventory](verification/localization-coverage.json). It inventories static/conditional `t()` keys and known tool/ribbon/settings label registries, reports built-in key/fallback availability by workflow and locale, and lists dynamic key expressions for manual review. Missing-key lists are deduplicated across locales with the same coverage.

This measures the availability of known translation keys. It excludes application copy that is not yet wired through translation, does not assess linguistic quality, and does not turn dictionary-entry counts into product-completeness percentages. Imported custom translations are excluded. `--check-core` fails when a selectable language lacks the shared core/interface keys; deeper workflow gaps remain visible in the report.
