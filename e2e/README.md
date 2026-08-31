# Browser tests

Playwright, driving the real app. `pnpm test:e2e`.

These are a **local gate**, not a CI step. The workflow runs lint, the
architecture guardrails, the typecheck, the unit suite and the build; it does
not run this. The reasoning is in `.github/workflows/ci.yml` beside the gap
where the step used to be, and it comes down to what the suite needs to do its
job: two servers it starts itself, a real browser, and a WebGL canvas. Under
software rendering on a shared runner that is the slowest and least stable
thing in the pipeline, and the unit suite already covers the same logic
headlessly. What this adds is that the logic reaches the screen — worth
asserting deliberately, before a release or when touching the shell, rather
than on every push.

So: run it before you push anything that touches routing, the workbench
shells, the viewport breakpoints, or the fold drape worker.

## Running it

```sh
pnpm test:e2e                      # everything
pnpm test:e2e --project=mobile     # one project
pnpm test:e2e --ui                 # pick through it interactively
```

`playwright.config.ts` starts both servers itself — the dev server, and a
`vite build` it then previews — so there is no server to start first. Budget
about two minutes.

Each case gets 90 seconds rather than Playwright's default 30. That is not
slack for slow tests: it is headroom for a slow *machine*. Mounting a WebGL
canvas without a GPU can take a large share of a 30-second budget on its own,
and everything after it in the same case then fails on the clock instead of on
the app — which reads as a broken test and is not one.

If Playwright's own browser download is unavailable (a sandbox, a container
with browsers pre-installed elsewhere), point it at the Chromium already on
the machine:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome pnpm test:e2e
```

Every project is Chromium-based, including `mobile` — it takes the iPhone 13
descriptor for its viewport and touch behaviour but overrides
`defaultBrowserType`, so that one variable covers the whole suite.

## The projects

| Project | Spec | What it holds down |
|---|---|---|
| `chromium` | `editor-smoke`, `fold-drape-worker`, `workbench-route` | the desktop editor: stitch editing, outlines becoming pieces, the drape solving off the main thread, and the workbench routes |
| `production-build` | `production-build` | the built bundle, served by `vite preview`. The dev server serves modules unbundled, so it cannot show a chunking fault; this is the only place the app is loaded the way a user loads it |
| `tablet` | `tablet-smoke` | 1024px — the far side of the 1100px mobile breakpoint, where the workbench must not degrade to the phone shell |
| `mobile` | `mobile-smoke` | the phone shell: the tab strip, the Options modal, touch targets, and the 2D/3D/Split routes |

## Writing one

Wait on the thing you are about to assert against, not on a duration. The 3D
workspace in particular arrives late — it mounts a WebGL canvas — so a case
that navigates into it and then does something else should wait for the canvas
first:

```ts
await page.locator('canvas.three-preview-canvas').waitFor()
```

Without that, the next step races the mount. It is the difference between a
case that is slow on a loaded machine and one that fails on it.
