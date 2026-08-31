/// <reference types="node" />

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileAiBuilderDocument } from './ai-builder-compile'
import { parseAiBuilderDocument } from './ai-builder-parse'
import type { AiBuilderCompileResult } from './ai-builder-types'

const BENCHMARK_ROOT = path.join(process.cwd(), 'ai-builder-benchmarks')
const OUTPUTS_DIR = path.join(BENCHMARK_ROOT, 'outputs')

type BenchmarkScore = {
  score: number
  maxScore: number
  notes: string[]
}

function listOutputFiles() {
  if (!existsSync(OUTPUTS_DIR)) {
    return []
  }

  // Same filter the functional harness honours, so an agent can score its own
  // file while others are writing this directory.
  const filter = process.env.AI_BENCH_FILTER ?? ''
  return readdirSync(OUTPUTS_DIR)
    .filter((fileName) => fileName.endsWith('.json') && fileName.includes(filter))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => path.join(OUTPUTS_DIR, fileName))
}

function scoreCompile(result: AiBuilderCompileResult): BenchmarkScore {
  const notes: string[] = []
  let score = 0
  const maxScore = 12

  if (result.summary.layerCount > 0) {
    score += 1
  } else {
    notes.push('no layers')
  }

  if (result.summary.shapeCount > 0) {
    score += 1
  } else {
    notes.push('no exportable shapes')
  }

  if (result.summary.patternPieceCount > 0) {
    score += 2
  } else {
    notes.push('no pattern pieces')
  }

  if (result.summary.seamAllowanceCount > 0) {
    score += 1
  } else {
    notes.push('no seam allowances')
  }

  if (result.summary.stitchHoleCount >= 2) {
    score += 2
  } else {
    notes.push('few or no generated stitch holes')
  }

  if (result.summary.seamConnectionCount > 0) {
    score += 1
  } else {
    notes.push('no seam connections')
  }

  if (result.summary.hardwareMarkerCount > 0) {
    score += 1
  } else {
    notes.push('no hardware markers')
  }

  if (result.summary.preflightErrorCount === 0) {
    score += 2
  } else {
    notes.push(`${result.summary.preflightErrorCount} preflight errors`)
  }

  if (result.summary.preflightWarningCount === 0) {
    score += 1
  } else {
    notes.push(`${result.summary.preflightWarningCount} preflight warnings`)
  }

  return { score, maxScore, notes }
}

function formatPreflight(result: AiBuilderCompileResult) {
  return result.preflight
    .map((issue) => `${issue.severity}:${issue.code}${issue.ref ? ` ${issue.ref}` : ''} - ${issue.message}`)
    .join('\n')
}

describe('AI Builder swarm benchmark outputs', () => {
  it('has an output folder for generated JSON files', () => {
    expect(existsSync(OUTPUTS_DIR)).toBe(true)
  })

  const outputFiles = listOutputFiles()

  if (outputFiles.length === 0) {
    it.todo('validates generated output JSON files after a swarm writes ai-builder-benchmarks/outputs/*.json')
  }

  outputFiles.forEach((outputFile) => {
    const fileName = path.basename(outputFile)

    it(`parses, compiles, and preflights ${fileName}`, () => {
      const source = readFileSync(outputFile, 'utf8')
      const parsed = parseAiBuilderDocument(source)

      expect(
        parsed.ok,
        parsed.ok ? undefined : parsed.errors.map((error) => `${error.path}: ${error.message}`).join('\n'),
      ).toBe(true)

      if (!parsed.ok) {
        return
      }

      const compiled = compileAiBuilderDocument(parsed.document)
      const score = scoreCompile(compiled)

      console.info(
        [
          `[ai-builder-benchmark] ${fileName}: ${score.score}/${score.maxScore}`,
          `pieces=${compiled.summary.patternPieceCount}`,
          `stitches=${compiled.summary.stitchHoleCount}`,
          `seams=${compiled.summary.seamConnectionCount}`,
          `hardware=${compiled.summary.hardwareMarkerCount}`,
          `warnings=${compiled.summary.preflightWarningCount}`,
          `notes=${score.notes.join(', ') || 'none'}`,
        ].join(' '),
      )

      expect(compiled.summary.shapeCount).toBeGreaterThan(0)
      expect(compiled.summary.patternPieceCount).toBeGreaterThan(0)
      expect(compiled.summary.preflightErrorCount, formatPreflight(compiled)).toBe(0)
    })
  })
})
