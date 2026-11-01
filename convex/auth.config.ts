import type { AuthConfig } from 'convex/server'

// A deployment with no issuer can serve the public gallery, but every private
// query and mutation still rejects anonymous callers. Configure a trusted OIDC
// provider before enabling sign-in; no user IDs are accepted from client input.
const issuer = process.env.AUTH_JWT_ISSUER
export default {
  providers: issuer ? [{ domain: issuer, applicationID: process.env.AUTH_JWT_AUDIENCE ?? 'leathercad' }] : [],
} satisfies AuthConfig
