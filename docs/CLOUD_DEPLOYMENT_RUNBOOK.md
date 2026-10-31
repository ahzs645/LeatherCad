# Cloud deployment and operations

Cloud code is implemented and tested locally. No deployment, identity-provider registration, live user account or external write has been configured or verified in this workspace. Local editing remains the primary workflow.

## Configure a real environment

1. Select separate development and production Convex deployments using the normal CLI authorization process. Register an existing public SPA OIDC client for Authorization Code + PKCE S256. Do not create a browser client secret.
2. Register the exact editor callback URI, including its Vite base path: `https://<editor-origin>/<base>/?lcad-oidc=callback`. The issuer's discovery and token endpoints must permit that origin.
3. Set frontend build values `VITE_CONVEX_URL`, `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`. Standard `*.convex.cloud` deployments derive the upload `*.convex.site` origin automatically. For custom domains or local Convex, also set `VITE_CONVEX_HTTP_URL` to the trusted HTTP-action origin (for example the configured local site origin). The backend uses its `CONVEX_SITE_URL` for the bounded upload endpoint. Set backend `AUTH_JWT_ISSUER` to the exact verified issuer and `AUTH_JWT_AUDIENCE` to that client ID. The built-in adapter sends an ID token, not a Google OAuth access token.
4. If moderation is enabled, set backend `COMMUNITY_MODERATORS` to a JSON array of exact verified `tokenIdentifier` values for designated operators. An absent or malformed value grants nobody moderator access. There is no client-controlled role assignment. Do not expose these identity values in public UI or documentation.
5. Run `pnpm exec convex codegen` against the selected development deployment, then `pnpm typecheck`, focused cloud tests, the full checks and a production build. Codegen replaces checked-in bootstrap server/component references. `convex/convex.config.ts` installs the official rate-limiter component; `convex/crons.ts` registers upload cleanup.
6. Deploy using the selected environment's normal reviewed deployment workflow. The repository does not contain working infrastructure credentials. Configuration and local tests do not establish a successful live deployment.

## Verify the deployed behavior

Use two independent test accounts plus an anonymous browser. Verify sign-in, callback cleanup, failure/cancellation and expiry; newest unsaved drawing recovery across redirect; local editing while provider requests fail; account switching during pending downloads/uploads; and local sign-out. Confirm tokens are absent from localStorage, sessionStorage user records, IndexedDB and application logs. One-use OIDC protocol state and the PKCE verifier may use sessionStorage.

For each account, create, reopen, update, rename, move, trash and restore drawings. Confirm an old selected revision cannot overwrite, rename or delete a newer drawing. Refreshing lists must not advance the revision of a selected editing target. Verify both content and location conflicts for folder moves. Confirm all private folders, settings, histories, assets, drafts and notifications stay isolated.

Publish a private version, a sanitized public next version and a later private version. Anonymous access must honor current pattern visibility and each requested historical version's visibility, including asset resolution. Confirm source attribution survives copying/editing/export and incompatible relicensing fails. Confirm stale content and visibility changes fail. A moderator-hidden pattern cannot be republished under that pattern ID by its owner.

Upload a large tracing image, reopen the cloud drawing and compare the reconstructed image bytes. Check interrupted uploads, digest/type/size mismatches, quota exhaustion and unused-file removal. Resolve private assets only as their owner; public asset resolution must name a permitted public pattern/version that actually references the asset.

Verify public title search excludes private content; replies notify only the topic owner; another account cannot read or mark those notifications; reporting is idempotent while a report remains open; ordinary users cannot inspect reports/audit or moderate; stale moderation decisions fail. Check keyboard/focus and phone layouts with actual network latency.

## Resource policies

| Resource | Enforced policy |
| --- | --- |
| Aggregate account content | 128 MiB canonical stored-content payload, including current drawings, snapshots, settings keys/values, publication credits/content/versions and board topic/reply rows; minimum 256 bytes per row; 256 drawings including Trash |
| Drawing JSON and a serialized settings/repository entry | 512 KiB each; larger payloads fail clearly |
| Embedded image/PDF/font offload | Known image fields with data URLs at least 32 KiB; PNG/JPEG/WebP/GIF/PDF/TTF/OTF; up to 64 distinct assets per drawing |
| Individual stored asset | 8 MiB for images/PDF, 4 MiB for fonts; SHA-256, declared type and size verified before attachment |
| Account asset quota | 64 MiB / 128 files, including pending reservations; owner-scoped deduplication |
| Private drawing history | Newest 100 content revisions; bounded cleanup on saves; publication versions are retained |
| Notifications | Newest 1,000 per topic owner; paginated reads |
| Authenticated cloud writes | Token bucket: 120/minute, burst capacity 300, per identity |
| Community writes | Additional token bucket: 30/minute, burst capacity 60, per identity |
| Upload reservations | Additional token bucket: 10/minute, burst capacity 64, per identity |
| Upload transfers | Additional token bucket: 60/minute, burst capacity 128, consumed before reading a new transfer |
| Board image attachments | Six PNG/JPEG/WebP/GIF images per topic/reply, 8 MiB each / 24 MiB total; follows current topic visibility |
| Pending upload reservation | Expires after one hour; hourly internal cleanup releases its quota |
| Ready assets without retained references | Removed after 24 hours by bounded internal cleanup; retained assets are preserved |
| Unregistered storage blobs | Hourly bounded scan removes blobs older than 24 hours with no cloud asset registration |

Asset transfers use an authenticated HTTP action with a per-reservation lease. It bounds the incoming stream to the reserved size and checks MIME signature and SHA-256 before storing bytes; the application never exposes an unrestricted storage upload URL. Reservation deduplication precedes its rate charge. A failed transaction rolls back rate-limit consumption with its other writes; the separate transfer-claim transaction commits before the body is read, so malformed transfer attempts still consume that budget. These application limits complement the hosting platform's request controls; they do not implement a network abuse firewall. Private drawing count and aggregate content are enforced by owner-scoped transactional usage counters and an idempotent content ledger. The accounting budget includes complete content fields such as credits and settings keys, with a 256-byte minimum; volatile server counters and timestamps use that per-row allowance. It is an application storage budget, not a physical disk or billing estimate. Billing, account suspension and complete user-data erasure remain separate work.

The main application's Convex file storage is currently owned exclusively by `cloudAssets`. Before adding another storage feature, register its files in that ownership system or update `cloudAssetMaintenance` to preserve its references. Component storage is scoped separately. Never repurpose the cleanup function as a public endpoint.

## Existing-data upgrade

The cloud library reads a small dedicated metadata table, avoiding complete drawing bodies in initial listings. New creates/saves/renames/restores mirror metadata transactionally. For data from a deployment predating accounting, use **Index older cloud drawings** before content writes. Its server-owned cursor resumes bounded phases for drawings, histories, settings, publications and their versions, then discussion topics/replies. Body pages are at most five rows; the operation is idempotent and restartable. Preexisting overages are recorded without deleting data. New/updated content is blocked until accounting completes. Existing folder browsing continues to support drawings without location rows.

Adding optional visibility and moderation fields preserves existing pattern rows. Older visibility counters start at zero. Expiring private history is an intentional retention policy: back up/export older revisions before activating the new writer on an existing deployment. Earlier revisions that were never saved cannot be reconstructed.

## Monitor, recover and roll back

Monitor Convex function errors, authorization rejection patterns, storage growth, mutation volume, rate-limit rejections, cleanup execution and component scheduling failures. Alert thresholds depend on the deployment's plan and real usage. Check production and development settings independently.

Use normal Convex snapshot exports/backups before a backend/schema upgrade; protect backups as private user data and store them outside the public repository. Rehearse restoring an entire snapshot into a separate development deployment, preserving document IDs and all linked tables rather than importing individual tables with new IDs. Include file storage in the platform-supported backup/export procedure. Verify assets and owner isolation after restoration. Keep the matching frontend build and backend version available for rollback.

Trash restoration creates a new revision in the root folder. Permanently deleting a selected drawing requires a separate explicit confirmation and runs in five-snapshot internal batches, releasing its content ledger, snapshots, metadata and asset references. It cannot be restored afterward. Moving a drawing to Trash is still allowed when the normal content quota is full: its one required delete snapshot is charged using a bounded cleanup reserve, so the reported total can temporarily exceed the normal allowance. Other content growth remains blocked. Oldest-revision cleanup runs before replacement charging, avoiding a spare-capacity requirement at the 100-revision limit. The last 100 private revisions and saved publication versions can reference assets, preventing their deletion. Soft deletion, tombstones and audit records are not a full erasure API. Export and restoration of local device projects are separate from cloud backups.

Storage download URLs are bearer capabilities once returned. Visibility and ownership checks govern obtaining a URL; making a pattern private does not revoke already issued URLs or downloaded licensed copies. If strict revocation is required, add an authenticated streaming proxy before promising that behavior.

Owners can explicitly retire all downloadable content of a publication. Five-version cleanup pages remove drawing JSON and asset links, keep minimal author/title/credit/license/version metadata for provenance, and release the removed payload’s quota. Retirement is irreversible; the pattern cannot be republished under that ID, and existing copies retain their license. Minimal immutable metadata can still exhaust an allowance eventually. An operator can use the internal-only `cloudQuota:setAllowance` function to configure an individual verified owner's allowance (1 MiB–4 GiB and 1–10,000 drawings). There is no browser role or public mutation for granting quota, and no invented billing flow.

Community moderation currently hides content and records a reason; it does not restore hidden material, suspend accounts, send email or implement appeals. Reports and decisions must be operated by a designated moderator. There are no external notification messages or automatic translation services.

## Local validation

```sh
pnpm exec vitest run src/features/editor/localdb/cloud-backend.test.ts src/features/editor/localdb/cloud-workspace-backend.test.ts src/features/editor/localdb/cloud-assets-backend.test.ts src/features/editor/localdb/cloud-operations-backend.test.ts src/features/editor/localdb/cloud-quota-backend.test.ts src/features/editor/localdb/cloud-upload-transport.test.ts src/features/editor/localdb/cloud-sync.test.ts src/features/editor/localdb/community-board.test.ts src/features/editor/localdb/oidc-cloud-auth.test.ts src/features/editor/localdb/initialize-editor-cloud-auth.test.ts src/features/editor/components/CloudCommunityDialog.test.tsx src/features/editor/components/CommunityBoardPanel.test.tsx src/features/editor/components/CloudLibraryPanel.test.tsx src/features/editor/components/BoardImageAttachments.test.tsx
pnpm typecheck:backend
```

The backend tests invoke actual registered functions and the official limiter component in Convex's test runtime. Storage tests cover real test-runtime metadata and bytes, owner and version access, authenticated bounded HTTP transfers, aggregate quota races/rollback/migration, integrity, abandoned-upload cleanup, retained links and publication retirement. They do not establish live JWT verification, provider registration, deployment codegen or storage hosting behavior.
