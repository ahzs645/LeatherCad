/**
 * The slice of the WebMCP browser API this app talks to.
 *
 * WebMCP lets a page hand an agent a set of typed tools instead of leaving it
 * to drive the UI by guesswork. The surface is small — `registerTool` with a
 * name, a description, a JSON Schema and an `execute` callback — so rather
 * than depend on a shim we declare it here and feature-detect at runtime.
 * `document.modelContext` is absent in every browser without the flag, which
 * is the normal case, so nothing here may assume it exists.
 *
 * Spec: https://github.com/webmachinelearning/webmcp
 */

export type WebMcpTextContent = {
  type: 'text'
  text: string
}

export type WebMcpToolResult = {
  content: WebMcpTextContent[]
  isError?: boolean
}

/**
 * A JSON Schema object as WebMCP consumes it. Kept deliberately loose in the
 * value position: agents read the schema, and the shapes we publish include
 * nested objects, enums and arrays that a tighter type would fight.
 */
export type WebMcpInputSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export type WebMcpToolInput = Record<string, unknown>

export type WebMcpToolDescriptor = {
  name: string
  description: string
  inputSchema: WebMcpInputSchema
  execute: (input: WebMcpToolInput) => Promise<WebMcpToolResult>
}

export type WebMcpRegisterOptions = {
  signal?: AbortSignal
}

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpToolDescriptor,
    options?: WebMcpRegisterOptions,
  ) => void | Promise<void>
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext
  }
}

/** The page's model context, or null when the browser has no WebMCP support. */
export function getModelContext(): WebMcpModelContext | null {
  if (typeof document === 'undefined') {
    return null
  }
  const context = document.modelContext
  if (!context || typeof context.registerTool !== 'function') {
    return null
  }
  return context
}

export function textResult(text: string): WebMcpToolResult {
  return { content: [{ type: 'text', text }] }
}

/**
 * Tool results are read by a model, so structured answers go out as JSON
 * inside the single text block the spec asks for rather than as prose the
 * agent would have to parse back.
 */
export function jsonResult(value: unknown): WebMcpToolResult {
  return textResult(JSON.stringify(value, null, 2))
}

export function errorResult(message: string): WebMcpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
