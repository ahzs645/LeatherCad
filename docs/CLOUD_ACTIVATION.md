# Activate and verify an existing cloud deployment

The code is ready for an existing Convex/OIDC setup. This workspace currently has no deployment selector, API/site URL, deploy authorization, OIDC issuer/client, local environment files or existing CLI session. The connected Convex tools provide setup guidance; they do not expose a configured deployment for this task. Nothing has been deployed or registered automatically.

The missing public inputs are:

| Input | Source |
| --- | --- |
| `CONVEX_DEPLOYMENT` | Existing `dev:name`, `prod:name` or `preview:name` deployment selector |
| `VITE_CONVEX_URL` | That deployment's API origin |
| `VITE_CONVEX_HTTP_URL` | Its HTTP-action origin; optional for standard `*.convex.cloud` → `*.convex.site` |
| `VITE_OIDC_AUTHORITY` | Existing OIDC provider/realm authority |
| `VITE_OIDC_CLIENT_ID` | Existing public SPA client with Code + PKCE S256 |
| `LEATHERCAD_CLOUD_EDITOR_URL` | Actual deployed editor directory URL, including the base path |
| `VITE_BASE_PATH` | Matching build base path, `/` by default |

Deploy authorization belongs in the existing CLI session or secret store. Two dedicated test accounts' current application ID tokens are needed for live isolation checks. Tokens can be supplied through the `LEATHERCAD_CLOUD_SMOKE_TOKEN_A/B` environment variables or `_FILE` paths. Do not paste credentials into an issue/chat, commit them, or pass them in command arguments. The example file contains no working account values.

## Inspect the configuration

```sh
cp .env.cloud.example .env.local
# Fill the public identifiers and configure authorization using the existing setup.
node scripts/cloud-preflight.mjs
```

The command loads `.env`, `.env.local`, `.env.<mode>` and `.env.<mode>.local`, in that order; existing process variables win. Use `--mode production` or explicit `--env-file` paths when appropriate. A report contains presence flags, public API/site origins, the exact derived callback and controlled diagnostics. It omits credentials, client ID values, subject IDs and raw provider/function bodies.

Register the reported callback on the SPA client. Confirm backend `AUTH_JWT_ISSUER` exactly matches OIDC discovery's issuer, and `AUTH_JWT_AUDIENCE` equals the SPA client ID. Supplying those declarations locally does not prove they are configured remotely.

```sh
node scripts/cloud-preflight.mjs --mode production --remote --out cloud-preflight.local.json
```

`--remote` performs read-only OIDC discovery, public gallery/topic reads, anonymous private-library denial and upload-route CORS checks. A missing function or failed server is not accepted as proof of authorization denial. No remote checks run without their configured origins. The report distinguishes blocked, configured-but-unverified and failed checks; exit code 2 means the requested verification is incomplete.

Discovery cannot prove the provider's registered callback, browser CORS behavior or client settings. Complete a real browser sign-in/callback/sign-out after deployment, including cancellation, expiry and unsaved-draft recovery. See [OIDC setup](OIDC_CLOUD_AUTH.md).

## Generate real backend types

```sh
node scripts/cloud-preflight.mjs --codegen
```

The wrapper requires an explicit existing deployment matching the API origin and configured CLI authorization. It rejects a deployment-scoped key for another target and anonymous setup mode. It invokes the installed CLI's `codegen --typecheck enable`, with no interactive stdin. The CLI documents codegen as local file generation that does not modify the code running on the deployment. No `dev`, `deploy`, project creation or login command is invoked. Raw CLI output is suppressed because SDK errors can echo configuration values.

Successful codegen replaces the bootstrap `convex/_generated` files; review and commit the resulting generated files through the normal repository workflow. Then run:

```sh
pnpm typecheck
pnpm test
```

If authorization/codegen fails, inspect the selected existing target and normal SDK diagnostics locally. No anonymous project is created as a fallback. Backend deployment remains a separate, explicit operation against the verified target described in [the operations runbook](CLOUD_DEPLOYMENT_RUNBOOK.md).

## Run live smoke checks

The default mode makes no mutations:

```sh
node scripts/cloud-smoke.mjs --out cloud-smoke.local.json
```

Without tokens, it verifies only anonymous access and reports `anonymous-only`, with exit code 2 to avoid presenting a partial check as full verification. With two distinct current ID tokens, it asks the live backend to authorize both accounts and reports `read-only-pass`. Local token claim decoding only guards account separation and routing; Convex performs signature and authorization validation. Read-only checks do not establish object isolation or stale-write behavior.

For a **dedicated test deployment and two test accounts**, opt into the complete mutation test and pin its exact API origin:

```sh
node scripts/cloud-smoke.mjs --write-smoke \
  --expect-origin https://YOUR-SELECTED-DEPLOYMENT.convex.cloud \
  --out cloud-smoke.local.json
```

Replace the example origin with the same real origin configured in `VITE_CONVEX_URL`. The command:

1. Creates uniquely marked drawings for A and B and checks mutual content/history isolation plus anonymous denial.
2. Uploads a unique synthetic PNG through the authenticated bounded HTTP endpoint, verifies the stored metadata and downloads/compares its bytes. JWTs are sent only to the configured HTTP-action origin; storage reads carry no JWT.
3. Checks private asset and private image-draft isolation, then verifies optimistic revision conflicts.
4. Publishes a private synthetic version followed by a public sanitized version, checking that private historical content/assets remain hidden.
5. Removes the private test draft, retires its synthetic publication, purges only the two uniquely marked test drawings and removes its asset after reference cleanup. It waits for bounded asynchronous purge/retirement work and reports incomplete cleanup as a failure.

The temporary public pattern's author may use the test account's provider display name. Use dedicated test identities. Existing real documents are neither edited nor indexed automatically. Legacy-account indexing requirements stop the run rather than migrating unrelated data. Retired publication license/version metadata and one removed-topic tombstone remain by design; this is not an account erasure test. Each PNG includes a unique marker to avoid deleting an unrelated deduplicated asset.

If a create response is lost, inspect only the report's unique marker in the dedicated account for unreturned reservations/publications. Cleanup failures include resource IDs and never count as a completed pass. Reports contain no tokens, private document bodies or account subjects. No report can substitute for an actual provider/browser/deployment check.

## Validate the tooling locally

```sh
node --test scripts/cloud-readiness.test.mjs
```

These tests exercise environment precedence/redaction, target/codegen guards, OIDC/public authorization probes, token routing, read-only behavior, the full smoke protocol, unique asset fixtures and cleanup-failure reporting with controlled test transports. They do not contact or claim a live deployment.
