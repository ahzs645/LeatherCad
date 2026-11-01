# Cloud library and community patterns

**Current direction: local-first, no Convex.** The implementation described below is inactive optional source. Hosted sharing and account setup are deferred. The [local workflow](LOCAL_FIRST_WORKFLOW.md) covers current saving, backup and file-sharing options.

LeatherCad keeps Dexie as its local primary store. Cloud operations are explicit copies: opening a remote drawing creates a separate local project, bulk upload skips conflicting IDs, and public gallery downloads include author, license, pattern ID and version in the copied document’s memo. No remote write happens simply by opening the editor or the cloud dialog.

The repository now includes a real Convex data client and backend. The backend has not been deployed or connected to a live account provider in this workspace. An optional built-in OIDC Code + PKCE adapter is available; see [built-in sign-in](./OIDC_CLOUD_AUTH.md). In an unconfigured installation, the dialog reports that cloud sharing is unavailable. It does not accept pasted credentials or report a simulated connection as successful.

## Deployable backend

The source is in `convex/`: private drawings/settings, versioned published patterns, owner authorization, indexed/paginated reads and explicit public/private visibility. Each public registered function has input and return validators. Identity comes from Convex’s verified `ctx.auth.getUserIdentity()`, never a client-supplied owner ID. Anonymous users can read only public publication metadata/content. Historical versions have their own visibility; making a later sanitized version public cannot expose an earlier private version.

Before deployment, configure an existing OIDC provider for the application. For Google sign-in, use your chosen provider’s Google connection and its Convex-compatible JWT. A Google OAuth access token alone is not a Convex application identity. This change does not invent an account provider, sign-in domain or client ID.

Required configuration:

| Location | Setting | Purpose |
| --- | --- | --- |
| Frontend build | `VITE_OIDC_AUTHORITY` / `VITE_OIDC_CLIENT_ID` | Optional built-in OIDC provider; an existing public SPA client registration is required. |
| Frontend build | `VITE_CONVEX_URL` | Convex deployment origin, or trusted runtime configuration passed to the connection API. |
| Convex deployment | `AUTH_JWT_ISSUER` | Trusted application JWT issuer URL. |
| Convex deployment | `AUTH_JWT_AUDIENCE` | Expected audience / application ID; defaults to `leathercad`. |
| CLI | `CONVEX_DEPLOYMENT` and normal deployment authorization | Target for Convex code generation and deployment. |

No issuer configured means the public gallery may be served, but all private operations remain unauthorized. No cloud deployment or credentials are included in this repository.

After selecting a real deployment and configuring the issuer, run Convex code generation and normal type checking before deployment:

```sh
pnpm exec convex codegen
pnpm typecheck
```

The checked-in `_generated/server.ts` and `_generated/dataModel.ts` are minimal typed bootstrap builders matching the installed SDK. `convex codegen` replaces them with deployment-generated files. In this environment, codegen reported `No CONVEX_DEPLOYMENT set`; no push was attempted.

## Built-in and host sign-in integration

The optional built-in adapter is activated by the frontend OIDC environment values above. Its callback uses the same-origin editor base URL with `?lcad-oidc=callback`; tokens remain in memory. For that adapter, set `AUTH_JWT_AUDIENCE` to the same public client ID and `AUTH_JWT_ISSUER` to the provider's exact OIDC issuer. Full configuration, storage and sign-out behavior are documented in [OIDC_CLOUD_AUTH.md](./OIDC_CLOUD_AUTH.md).

A trusted host can override the built-in adapter with its own established session SDK:

The host application registers its established sign-in provider through the source-owned connection API. Deployment URLs may be provided by build configuration. Tokens are requested when each network request begins and are never stored by LeatherCad in localStorage, IndexedDB or UI inputs.

```ts
import { configureEditorCloudAuth } from './src/features/editor/localdb/editor-cloud-connection'

// Bind these functions to the host's existing OIDC SDK/session. Do not put
// service credentials or a hard-coded user token into this configuration.
const unregister = configureEditorCloudAuth({
  getUser: () => session.user ? { id: session.user.id, displayName: session.user.displayName } : null,
  getToken: () => session.getTokenForConvex(),
  signIn: () => session.signIn(),
  signOut: () => session.signOut(),
  subscribe: listener => session.onChange(listener),
})
```

`session` in this example represents the host’s selected SDK, not an exported LeatherCad implementation. This host glue is optional when the built-in OIDC adapter is configured; otherwise connecting a real SDK remains a required activation step. The dialog calls only this trusted boundary; it has no infrastructure or credential controls.

## Persistence and conflict semantics

- Drawing writes include a revision token for optimistic concurrency. A listing refresh does not silently advance the token of an editing snapshot. A stale save fails and requires an explicit refresh.
- Normal cloud reads preserve shape IDs and validate document geometry with the JSON parser’s opt-in ID-preservation mode. Ordinary file imports continue generating fresh IDs.
- Cloud document IDs are user-scoped. Private settings, autosave, template and catalog repositories are isolated by the verified owner identity.
- Bulk project upload creates missing IDs, skips identical documents and reports conflicting existing documents without overwriting them. It does not replace remote repositories.
- Public/private publication changes are owner-only. New versions preserve prior snapshots and their licenses. Historical content is readable by other users only if both the current pattern and that historical version are public.
- Copies retain attribution at the start of the memo, within the existing 8000-character import limit. A full original memo cannot push license credit beyond that limit.
- Copies also retain structured `communityProvenance` through editor load/save/history and JSON roundtrips. Publication checks each known source against its stored version and refuses to weaken a CC BY-NC source to CC BY/CC0 or a CC BY source to CC0. Upstream credits are included in publication attribution. Manually removed provenance or independently recreated content cannot be detected by this metadata mechanism.
- Switching accounts resets the dialog’s private caches and form state by stable identity/session key. Clients retained from an earlier sign-in session refuse requests rather than using a later account’s token.

## Current limits

This is a reviewable cloud/community foundation, not a claim of full Guild parity. A real deployment and either the built-in OIDC issuer/client configuration or trusted host sign-in integration are still required to activate remote behavior. The adapter supports project CRUD, snapshots, settings, template/catalog storage, gallery publishing, version readback and public/private access. Private folders and drawing revision history are covered in [CLOUD_WORKSPACE.md](./CLOUD_WORKSPACE.md). Community board topics/replies and likes are implemented as a separate authenticated module. Image attachments with upload progress/retry, reporting, server-authorized moderation with audit records, public title search and in-app reply notifications are now included. Translation services, billing, account suspension, moderator appeals and live collaboration remain outside this implementation.

Drawing JSON and individual serialized library entries are capped at 512 KiB. Large embedded image/PDF/font data URLs in supported image fields are uploaded separately to owner-authorized Convex storage and reconstructed as portable data URLs on read. Limits are 8 MiB per image/PDF or 4 MiB per manufacturing font, 64 MiB / 128 stored or reserved assets per account and 64 assets per drawing. Geometry-only JSON exceeding the row limit still fails clearly and remains local. Assets referenced by retained drawing/publication versions cannot be removed. The newest 100 private drawing revisions are retained; publication versions remain available subject to visibility until their owner explicitly retires downloadable content. Retirement retains credit/license/version metadata for provenance. Cloud publication currently supports CC0 1.0, CC BY 4.0 and CC BY-NC 4.0. Version histories are immutable snapshots; visibility can be withdrawn, but downloaded licensed copies remain outside the service’s control.

## Verification

Run the focused contract and authorization checks:

```sh
pnpm exec vitest run src/features/editor/localdb/cloud-backend.test.ts src/features/editor/localdb/cloud-sync.test.ts
pnpm typecheck:cloud
```

These execute the real registered backend functions against Convex’s testing implementation and exercise the real adapter, authorization, private histories, stale revisions, shape identity, pagination, snapshots, repository isolation, attributed copies and HTTP failure handling. They do not establish a deployed service or live account authorization.

## Library lifecycle and operations

The cloud dialog lists small metadata pages and fetches drawing content on demand. Select a drawing to open a local copy, update it from the current drawing, rename it or move it to Trash. Updates and deletes use the selected revision; refreshing a list does not advance that editing snapshot. Trash restoration creates a new revision. Pattern publishing can edit title, description, credit, license and visibility as a new version; visibility has its own conflict counter. Legacy drawings can be indexed in bounded owner-scoped pages.

The official Convex rate-limiter component enforces per-identity cloud/community/upload budgets. Hourly internal cleanup releases expired upload reservations and removes old unregistered file blobs. See [deployment and operations](CLOUD_DEPLOYMENT_RUNBOOK.md) for exact quotas, migration, backup and live-verification steps, including the bearer nature of issued storage URLs.

Aggregate stored-content accounting now covers drawings, snapshots, library settings, publication content/credits/version history and discussion text, including a 256-byte minimum per row. Defaults are 128 MiB and 256 drawings including Trash. A resumable owner-scoped upgrade indexes older data before new writes; counters and ledger updates are transactional. Explicit per-drawing permanent deletion and publication content retirement release removable payloads. Internal operator allowances can recover an account whose retained metadata fills its budget; there is no client-granted quota or billing UI.

Uploads use authenticated bounded HTTP actions with stream, signature and digest validation before storage. Standard Convex cloud deployments derive their site origin; custom/local deployments require a trusted `VITE_CONVEX_HTTP_URL`. Ready files without retained references are collected after 24 hours. Board drafts and published attachments retain their files under current topic/reply visibility.
