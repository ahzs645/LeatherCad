import { describe, expect, it, vi } from 'vitest'
import { createConvexTransport } from './convex-transport'

describe('authenticated cloud asset transport', () => {
  it('binds uploads to the configured HTTP origin and checks the session around token acquisition', async () => {
    let session = 1
    const fetcher = vi.fn(async () => new Response('{}'))
    const transport = createConvexTransport({ url: 'https://example.convex.cloud', assertSession: () => { if (session !== 1) throw new Error('Session changed') }, getAuthToken: async () => 'identity-token', fetch: fetcher })
    await transport.uploadAsset!('https://example.convex.site/cloud-assets/upload', 'asset-id', new Blob(['bytes'], { type: 'image/png' }))
    expect(fetcher).toHaveBeenCalledWith('https://example.convex.site/cloud-assets/upload', expect.objectContaining({ credentials: 'omit', headers: { Authorization: 'Bearer identity-token', 'Content-Type': 'image/png', 'X-LeatherCad-Asset': 'asset-id' } }))
    await expect(transport.uploadAsset!('https://untrusted.test/cloud-assets/upload', 'asset-id', new Blob(['bytes']))).rejects.toThrow('origin')
    session = 2
    await expect(transport.uploadAsset!('https://example.convex.site/cloud-assets/upload', 'asset-id', new Blob(['bytes']))).rejects.toThrow('Session changed')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
