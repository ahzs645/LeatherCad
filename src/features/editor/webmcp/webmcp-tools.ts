/**
 * The full set of tools this page offers an agent, wrapped so that a bad call
 * is an answer rather than an exception.
 *
 * Two things happen to every tool on the way out. It gets a try/catch, because
 * a throw inside `execute` surfaces to the agent as an opaque failure and it is
 * far more useful to hand back the reason — a missing argument, a document that
 * did not validate — as text the model can act on. And it gets recorded, so the
 * person sharing the page can see the call, its arguments and its result.
 */

import { errorResult, type WebMcpToolDescriptor, type WebMcpToolResult } from './webmcp-api'
import { recordWebMcpActivity } from './webmcp-activity'
import type { WebMcpBridge } from './webmcp-bridge-types'
import { WebMcpInputError } from './webmcp-input'
import { buildInspectTools } from './webmcp-tools-inspect'
import { buildEditTools } from './webmcp-tools-edit'

/** How much of a result to keep for the activity panel's detail view. */
const DETAIL_LIMIT = 1200

function summarize(result: WebMcpToolResult): string {
  const text = result.content.map((part) => part.text).join(' ')
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? ''
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
}

function describeInput(input: Record<string, unknown>): string {
  const keys = Object.keys(input)
  if (keys.length === 0) {
    return '()'
  }
  try {
    const json = JSON.stringify(input)
    return json.length > 200 ? `${json.slice(0, 197)}...` : json
  } catch {
    return `(${keys.join(', ')})`
  }
}

function instrument(tool: WebMcpToolDescriptor): WebMcpToolDescriptor {
  return {
    ...tool,
    execute: async (input) => {
      const startedAt = Date.now()
      try {
        const result = await tool.execute(input)
        recordWebMcpActivity({
          toolName: tool.name,
          status: result.isError ? 'error' : 'ok',
          summary: `${describeInput(input)} -> ${summarize(result)}`,
          detail: result.content.map((part) => part.text).join('\n').slice(0, DETAIL_LIMIT),
          durationMs: Date.now() - startedAt,
        })
        return result
      } catch (error) {
        const message =
          error instanceof WebMcpInputError
            ? error.message
            : error instanceof Error
              ? `${tool.name} failed: ${error.message}`
              : `${tool.name} failed.`
        recordWebMcpActivity({
          toolName: tool.name,
          status: 'error',
          summary: message,
          detail: message,
          durationMs: Date.now() - startedAt,
        })
        return errorResult(message)
      }
    },
  }
}

export function buildWebMcpTools(bridge: WebMcpBridge): WebMcpToolDescriptor[] {
  return [...buildInspectTools(bridge), ...buildEditTools(bridge)].map(instrument)
}

/**
 * The published tool names, for UI that has to list them without holding a
 * bridge to the editor. Declared rather than derived so the panel does not have
 * to build a tool set to render a chip row; `webmcp-tools.test.ts` asserts this
 * stays in step with what `buildWebMcpTools` actually returns.
 */
export const WEBMCP_TOOL_NAMES = [
  'get_pattern_overview',
  'list_pattern_pieces',
  'check_pattern',
  'estimate_material',
  'describe_pattern_format',
  'create_pattern_piece',
  'add_stitch_line',
  'apply_pattern_json',
  'select_pattern_pieces',
  'clear_document',
  'rename_document',
  'undo_last_change',
  'export_pattern',
] as const
