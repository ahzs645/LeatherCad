import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Generate an STL printer fit gauge, measurement JSON and checklist. Usage: pnpm calibration:stl [--out-dir PATH]. Physical checks remain unperformed.')
} else {
  const flag = args.indexOf('--out-dir')
  if (flag >= 0 && !args[flag + 1]) throw new Error('--out-dir requires a path.')
  const output = flag >= 0 ? resolve(args[flag + 1]) : resolve(root, 'artifacts/printer-fit-calibration')
  const server = await createServer({ root, configFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, cacheDir: resolve(tmpdir(), 'leathercad-calibration-vite'), server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { buildPrinterFitCalibration } = await server.ssrLoadModule('/src/features/editor/io/manufacturing/manufacturing-calibration.ts')
    const fixture = buildPrinterFitCalibration()
    await mkdir(output, { recursive: true })
    await writeFile(resolve(output, 'leathercad-printer-fit-gauge.stl'), fixture.content)
    await writeFile(resolve(output, 'measurements.json'), JSON.stringify(fixture.manifest, null, 2) + '\n')
    await writeFile(resolve(output, 'CHECKLIST.txt'), fixture.checklist)
    console.log(`Generated printer fit calibration in ${output}. Physical printing and measurements are unperformed.`)
  } finally { await server.close() }
}
