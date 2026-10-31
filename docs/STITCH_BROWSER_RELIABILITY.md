# Stitch browser check and development-server reload fix

The original comparison run passed 20 of 21 browser cases. Its failing case timed out finding the `Simulate` button after marking a terminal stitch hole; the isolated retry passed.

On the current implementation, the unchanged case passed six repetitions with two workers and system Chromium. Traces from that baseline are preserved under `/workspace/scratch/leathercad-comparison/stitch-baseline-results`, with the run log at `stitch-baseline.log` in the same parent directory. This investigation did not reproduce a deterministic application failure. The workbench ribbon tab state has no automatic selection-driven switching path; it changes through explicit tab actions.

The case now addresses the Stitch tab and commands through their existing stable test IDs, asserts `aria-selected=true` after tab activation, and checks the simulator command is both visible and enabled. The terminal-marker assertion still proves that the document update completed before simulator interaction. These state assertions distinguish a failed tab transition from a failed command render and avoid dependence on translated button names.

The updated case also passed all six repetitions with two workers (1.9 minutes under concurrent validation load). Its log is `/workspace/scratch/leathercad-comparison/stitch-verified.log`.

The final parallel integration run reproduced the failure and established its cause. The simulator command was selected, visible, enabled and clicked; its first modal assertion passed. At trace time **35.289 seconds**, the browser fetched `/` again. Vite reconnected and all optimized-dependency URLs changed from `?v=56c892d5` to `?v=5d6ab6db`. React then restarted with the default drawing because the one-use `?openDoc` seed had already been consumed.

This was a Vite dependency-optimizer page reload, not a missing stitch command. A concurrent case opened the first 3D view, bringing in lazy Three.js add-ons through the linked Atelier engine. Those source packages were intentionally excluded from Vite's scanner, so the add-ons were discovered after editing had begun.

`vite.config.ts` now explicitly includes the known linked-engine browser dependencies in startup optimization: the Three.js controls/render passes/loaders/exporters and the nested Delaunator dependency. Atelier source remains excluded from prebundling. The configuration also accepts `VITE_CACHE_DIR` so a cold-cache browser run can be verified independently of the developer's existing cache.

No sleeps, retries, larger timeouts or skipped cases were added. The final cold-cache parallel suite exercises the first 3D/STL loads alongside the stitch case; its results are recorded in the [implementation report](COFFEE_CAD_IMPLEMENTATION_2026-10-31.md).

Repeat the case with:

```sh
cd /workspace/leathercad
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  node node_modules/@playwright/test/cli.js test \
  --config /workspace/scratch/leathercad-comparison/stitch-verified-playwright.config.ts \
  --project=chromium --grep 'terminal stitch editing' --repeat-each=6 --workers=2
```

The verification config uses a fresh `stitch-verified-results` directory, retaining all traces without overwriting the original comparison or the six-case baseline evidence.

The optimizer-reload observations are recorded in `/workspace/scratch/leathercad-comparison/vite-optimizer-diagnosis.json`, with the original full-run log at `final-browser-tests.log`. The original trace was inspected before a later run cleaned its test-output directory. The final cold-cache run passed **all 28 cases** and is logged at `final-cold-browser-tests.log`.
