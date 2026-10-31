# Reproducing and verifying a release

`engine-pair.json` pins the compatible Atelier engine at `186feaf7b63e0928c5a27a78f874497e1a8cdfdd`. App dependencies intentionally link its TypeScript source from a sibling `atelier/` checkout. CI, Pages and the release verification workflow all use this exact revision.

Use sibling directories, Node 22 and pnpm 10.18.1:

```sh
git clone https://github.com/ahzs645/atelier.git atelier
git -C atelier checkout 186feaf7b63e0928c5a27a78f874497e1a8cdfdd
git clone https://github.com/ahzs645/LeatherCad.git LeatherCad
cd atelier
pnpm install --frozen-lockfile
cd ../LeatherCad
pnpm install --frozen-lockfile
pnpm check:engine
pnpm lint
pnpm check:architecture
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:release
```

`check:engine` rejects a mismatched or modified engine checkout and inconsistent workflow pins. The build writes `dist/release-pair.json` containing both Git revisions, whether the app checkout is modified, Node version and package manager. A release artifact should have `appWorkingTreeModified: false`; development builds may be marked modified.

`test:release` starts only a production preview of the existing `dist/`. It verifies boot, PDF worker/vector import through review, lazy file tools/library download, cloud availability, native-curve creation/edit/export, interchange failure paths, advanced STL workers/settings/fonts, and the pairing artifact. The full `pnpm test:e2e` remains the desktop/tablet/phone and simulation gate. Pages runs the built-bundle gate before uploading its artifact. The manual/tag-triggered **Verify release pair** workflow runs the clean-install checks and retains the bundle and browser failure evidence; it does not publish a release.

For a system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. A path-prefixed build can use `LEATHERCAD_RELEASE_URL=http://127.0.0.1:41742/LeatherCad/` with the release gate. Verify the exact built artifact intended for deployment.

## Updating the engine pair

Make the engine change in its own repository first. Set the candidate full commit in `engine-pair.json` and the three workflow `ref:` fields. Check out that exact engine commit locally, perform the clean-install sequence above, and run the full browser suite. Review linked API and serialized document compatibility. Commit the new pair and verification evidence together in LeatherCad; an engine branch name or moving default branch is insufficient.

## Library and PDF review checks

File tools exposes a versioned local library backup. Its database payload covers saved projects (including the stored autosave record), templates, catalogs and database settings. A separate, versioned browser-preferences envelope includes explicitly allowlisted app preferences, custom irons and template folders. OIDC state, credentials, clipboard content and recovery drafts are excluded. Save the open drawing before downloading a library backup.

Restore validates the entire payload first. Merge adds missing IDs and preserves current records on conflicts; replace restores the saved database tables. IndexedDB writes use one transaction and roll back together. Browser preferences are a separate store: reported write/database failures attempt to restore their previous values, but a browser crash or simultaneous tab writes cannot be made atomic across the two stores. Retain a prior backup until verifying the result. A failure to roll preferences back is reported explicitly; it never becomes a successful restore notification.

Pattern PDF import scans up to 128 pages/50 MB, suggests a page containing pieces, and shows the geometry, detected pitch, seam/fold counts and uncertainty. The maker can remove inferred stitching or fold lines before accepting. Confirmation requires explicit review; cancellation preserves the open document. All inferred geometry still requires checking against the paper pattern and its scale.
