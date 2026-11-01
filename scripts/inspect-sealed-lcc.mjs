#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Reports protocol metadata/counts only. It never exports or loads decoded artwork.
const args = process.argv.slice(2)
const unverified = args.includes('--unverified')
const files = args.filter(arg => arg !== '--unverified')
if (files.length !== 1) {
  console.error('Usage: node scripts/inspect-sealed-lcc.mjs [--unverified] FILE.lcc')
  process.exitCode = 1
} else {
  let server
  try {
    const file = files[0]
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error('Input exceeds the 50 MB file limit')
    const bytes = await readFile(file)
    const root = fileURLToPath(new URL('../', import.meta.url))
    server = await createServer({ root, configFile: false, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
    const { inspectSealedLccPayload } = /** @type {{ inspectSealedLccPayload: (raw: string, options: {verifyIntegrity: boolean}) => Promise<Record<string, unknown>> }} */ (await server.ssrLoadModule('/src/features/editor/io/io-lcc-sealed.ts'))
    const report = await inspectSealedLccPayload(bytes.toString('utf8'), { verifyIntegrity: !unverified })
    console.log(JSON.stringify({ inputSha256: createHash('sha256').update(bytes).digest('hex'), ...report }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Sealed LCC inspection failed')
    process.exitCode = 1
  } finally {
    await server?.close()
  }
}
