# Built-in cloud sign-in

LeatherCad includes an optional `oidc-client-ts` Authorization Code + PKCE adapter. With no OIDC settings, local editing starts normally and the authentication SDK is not loaded. Configured authentication starts asynchronously; a slow identity provider does not block the CAD editor.

Set these public frontend build values for an existing SPA/public OIDC application:

```dotenv
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_OIDC_AUTHORITY=https://your-existing-identity-provider.example/your-issuer
VITE_OIDC_CLIENT_ID=your-registered-public-client-id
```

The values above are placeholders, not working accounts or invented credentials. Configure the provider for Authorization Code, PKCE S256, and a public browser client with no client secret. Its discovery and token endpoints must support the deployed editor origin. For Google sign-in, configure the provider's established Google connection; LeatherCad signs in through that provider and does not treat a Google OAuth access token as a Convex identity.

Register this exact redirect URI, using the app's deployed origin and Vite base path:

```text
https://your-editor.example/<base-path>/?lcad-oidc=callback
```

For a root deployment it is `https://your-editor.example/?lcad-oidc=callback`. For local development, register the corresponding localhost origin and port. The callback uses the existing editor entry URL, so static hosts do not need a separate callback server route. The SDK validates the saved protocol state and exchanges the code with PKCE. Callback code/state/error parameters are scrubbed from browser history immediately, before provider discovery or token exchange; after completion, the saved same-origin editor route is restored. External return targets are refused.

Configure the backend to trust the same identity token:

```dotenv
AUTH_JWT_ISSUER=<exact issuer claim from this provider's OIDC metadata>
AUTH_JWT_AUDIENCE=<same value as VITE_OIDC_CLIENT_ID>
```

The built-in adapter sends the OIDC **ID token** to Convex. Convex validates its signature, issuer, audience and expiry before private queries or mutations. Do not substitute an OAuth access token or configure a different API audience for this adapter. A custom trusted host adapter may implement a different provider-approved JWT contract through `configureEditorCloudAuth`.

The existing Cloud & Community dialog's Sign in button calls the SDK redirect flow once these settings are present. No provider URLs, tokens, secrets or client IDs are entered into the product UI. A provider already installed through the trusted host API takes precedence, including if it is installed while the default SDK chunk loads.

Authenticated users, ID/access/refresh tokens and SDK user records stay in memory. Only one-use protocol request state, the PKCE verifier and the same-origin return route may use sessionStorage to survive the redirect. Tokens are not written to localStorage, sessionStorage or IndexedDB. Reloading the page therefore requires signing in again; the provider's existing SSO session may make that redirect quick. Automatic silent renewal is disabled. Expired identity tokens stop being returned and clear the cloud user state.

Sign out clears the editor's in-memory session. It does not sign the person out of their Google account or revoke the provider's wider SSO session. The SDK and callback errors exposed by LeatherCad are generic and do not echo token-bearing URLs or raw provider error descriptions.

Verification uses mocked SDK operations plus the real SDK storage classes to test code/PKCE configuration, memory-only user storage, callback URL cleanup, unsafe return targets, expiry/account changes, concurrent initialization, missing settings and trusted host overrides. It does not claim a live provider registration or a deployed Convex service; those require the actual issuer/client/deployment configuration.
