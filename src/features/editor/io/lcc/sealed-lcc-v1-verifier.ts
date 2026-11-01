import { SealedLccError } from './sealed-lcc-envelope'

// Read-only compatibility parameter for the globally shipped v1 file format.
// Observed in the user-supplied Coffee Craft CAD web build 2026-10-27.
// This is not a service/account credential, author signature or license grant.
// Only Web Crypto verification is enabled; no product sealing/export API exists.
// Provenance and scope: docs/SEALED_LCC_COMPATIBILITY.md.
const V1_FORMAT_INTEGRITY_PARAMETER = new Uint8Array([62, 88, 235, 23, 53, 47, 149, 254, 34, 53, 68, 92, 247, 113, 31, 152, 50, 199, 166, 237, 239, 250, 90, 217, 94, 155, 215, 69, 125, 56, 2, 171])
let verificationKey: Promise<CryptoKey> | null = null

export function referenceSealedLccV1VerificationKey(): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new SealedLccError('verifier-unavailable', 'Web Crypto is unavailable; integrity verification cannot be skipped')
  verificationKey ??= subtle.importKey('raw', V1_FORMAT_INTEGRITY_PARAMETER, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return verificationKey
}
