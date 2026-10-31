# Private cloud folders and drawing history

Cloud & Community includes a signed-in **Folders and revision history** panel. It uses the same verified Convex identity and session-bound transport as the private library. It does not create a second backend or store authentication tokens.

## Folders

- Create and rename folders, navigate child folders, and choose a destination before moving a folder or drawing.
- Folder names are limited to 120 characters and are unique, case-insensitively, within one parent.
- Only the owner can read or change a folder. A drawing cannot be moved into another owner’s folder.
- The backend rejects self/descendant moves, trees deeper than 32 levels, and moves of more than 1,000 descendant nodes in a single transaction. Large trees must be moved in smaller parts.
- Deleting a folder requires it to contain no drawings or child folders. Deleting an empty folder does not delete drawing content.
- Folder changes use expected revisions. Drawing moves check both the drawing’s content revision and its location revision, so a stale listing cannot overwrite a newer move or content update.

Root folder lists unfiled drawings, including older drawings that have no location record yet. Folder browsing and history lists paginate; they do not issue an unbounded table collection. Content-bearing reads use pages of five rows to keep 512 KiB drawing payloads within query limits.

## Immutable drawing revisions

Every cloud document create/save records a snapshot in the same transaction as its content write. Existing drawings record their current baseline the next time they are saved. Earlier revisions that were never recorded cannot be reconstructed.

Selecting a drawing lists its recorded revisions. **Open local copy** reads and validates that revision, creates a separate local project, and opens the copy without changing cloud history. **Restore as new revision** checks the latest content revision, copies the selected snapshot into a new revision, and keeps all older snapshots. Restore does not move the drawing to another folder.

Soft deletion keeps the final content snapshot and removes the drawing’s folder assignment. Owner-authorized backend restoration can recover a deleted document as a new revision in the root folder. A dedicated trash browser is not included in this panel.

No public mutation edits or deletes an existing snapshot. Snapshot readback and restore verify ownership using the current authenticated owner, not a caller-supplied user ID. Restoring an old revision with a stale expected version fails instead of replacing newer edits.

The UI clears private state when the account/session changes. Pending reads cannot populate a later session; a local revision copy that finishes after the initiating session is invalidated is removed rather than opened.

## Source and activation

- `convex/cloudWorkspaceSchema.ts`: folder, location and immutable revision tables, validators and indexes.
- `convex/cloudWorkspaceHistory.ts`: transactional snapshot and location hooks used by `cloudDocuments.ts`.
- `convex/cloudWorkspace.ts`: owner-authorized folder, move, history, readback and restore endpoints.
- `src/features/editor/localdb/cloud-workspace-client.ts`: the source-owned client adapter with pagination and document validation.
- `src/features/editor/components/CloudWorkspacePanel.tsx`: the signed-in library panel.

The existing [cloud setup](CLOUD_COMMUNITY.md) must be configured before this feature can operate against a real deployment. This work has been checked locally; it does not deploy a backend or perform a live cloud write.

## Verification

```sh
node node_modules/vitest/vitest.mjs run src/features/editor/localdb/cloud-workspace-backend.test.ts
node node_modules/typescript/bin/tsc --noEmit -p convex/tsconfig.json
```

The tests invoke the real registered Convex functions and real workspace client. They cover anonymous and cross-user denial, sibling name conflicts, cycles, depth, nonempty deletion, stale content/location moves, immutable restore, soft deletion, baseline migration and multi-page folders/documents/history. These checks establish local behavior, not live deployment authorization.
