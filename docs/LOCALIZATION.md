# Interface languages

Language switching is available in the workbench header, in the phone Options menu, and in the main Options dialog. It updates controls immediately, sets the document’s HTML language for assistive technology, and persists the choice in this browser. English is the default.

## Coverage

The catalog offers the same 20 languages as the reviewed reference app. Coverage is deliberately distinguished:

| Language | Bundled translation entries | Scope |
| --- | ---: | --- |
| English | Source text | Default interface and fallback |
| Japanese | 914 | Main workbench and phone controls, Options/input/preset controls, geometry/protection inspector, recovery decisions/actions, print preview and manufacturing controls; selected cloud-library actions and confirmation copy |
| Armenian, Danish, German, Spanish, Finnish, French, Italian, Korean, Norwegian, Polish, Brazilian Portuguese, Portuguese, Romanian, Russian, Turkish, Ukrainian, Traditional Chinese, Simplified Chinese | 170 each | Editing shell and tools, common file actions, recovery decisions/actions, native geometry/protection inspector, and shared print/manufacturing controls |

All 19 non-English dictionaries include the recovery choice, replacement warning and actions; native cubic/ellipse fields, validation and shape-protection controls; and 39 shared specialist labels, four fit-calibration actions and physical-unit aliases. Japanese additionally supplies the complete currently inventoried print-preview and manufacturing control copy. Recovery timestamps use the selected locale. Domain identifiers, paper IDs and canonical millimetre values do not change.

The used-key audit currently finds 1002 keys. It resolves 766 in Japanese and 145 in each smaller dictionary. By workflow, Japanese resolves print preview 49/49, manufacturing 109/109 and recovery 14/14; each smaller dictionary resolves recovery 14/14 and the geometry inspector's static keys 17/17. Dynamic native point labels are also verified in the rendered inspector. These are counts of inventoried keys, not product-completeness percentages: recovery errors use dynamic keys, and unwired copy is outside that denominator.

Remaining work includes print controls/guidance and manufacturing region/finish/font copy in the 18 smaller dictionaries; deeper cloud sharing/workspace/moderation flows in every non-English locale; geometry-dialog and Options copy in the 18 smaller dictionaries; and dynamic technical diagnostics. Japanese resolves the geometry-dialog static keys 42/42 and Options 156/159; the three unchanged Options entries are the DXF, R12 and R14 format/version codes. App-owned backend errors may still appear in English. The generated fit-gauge measurement checklist currently remains English in every interface language. The supplied translations have not had native-speaking CAD or manufacturing expert review.

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

`LanguageSelector.test.tsx` verifies actual header/ribbon switching, persistence, imported overrides, fallback, cross-tab updates, sample German/French/Chinese controls and shared-key coverage for all selectable languages. `SpecialistLocalization.test.tsx` renders every locale's recovery decisions and native inspector, checks canonical geometry/settings and user group/draft preservation, and exercises localized print/manufacturing inputs, whole-message placeholders and imported overrides. Existing Workbench tests continue to run in English.

`e2e/localization.spec.ts` checks desktop Japanese/German switching and persistence, the phone language selector, and Japanese/German print controls at desktop and 390px phone widths. The print check preserves paper IDs and numeric input, verifies exact US Letter dimensions, checks horizontal overflow and reaches the print action by scrolling. Screenshots are in [desktop print](verification/specialist-print-desktop.png), [Japanese phone print](verification/specialist-print-phone.png) and [German phone print](verification/specialist-print-german-phone.png). These checks do not replace fluent-speaker review or prove complete localization of all 20 languages.

`StlCalibrationDownload.test.tsx` verifies independent checklist downloads without Worker support, one cached gauge packet, synchronous startup/post failures, malformed-response retry and cancellation after timeout or unmount. `e2e/calibration.spec.ts` downloads the actual worker-generated 88 × 60 × 8 mm gauge, verifies the current drawing STL remains byte-identical, and checks the Japanese panel at 390px. See [calibration panel](verification/specialist-calibration-panel.png) and [Japanese phone panel](verification/specialist-calibration-phone.png). Physical printing and hardware measurements remain unperformed.

## Source-backed coverage audit

Run `node scripts/audit-localization.mjs --out docs/verification/localization-coverage.json --check-core` to regenerate the [used-key inventory](verification/localization-coverage.json). It inventories static/conditional `t()` keys and known tool/ribbon/settings/manufacturing label and application-owned manufacturing-error registries, reports built-in key/fallback availability by workflow and locale, and lists dynamic key expressions for manual review. Missing-key lists are deduplicated across locales with the same coverage.

The report separately lists candidate unwired JSX/accessibility copy for manual review, and validates placeholder sets in built-in translations. Candidates are not counted as translated keys. Dynamic expressions remain visible rather than being assumed covered. Imported custom translations and user-generated text are excluded. `--check-core` fails when a selectable language lacks the shared shell, recovery, specialist-control or native-editor vocabulary, or when a built-in placeholder set changes. Deeper workflow gaps remain visible; linguistic quality requires human review.
