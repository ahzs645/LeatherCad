import { createElement, useEffect } from 'react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { createDefaultLineTypes, CUT_LINE_TYPE_ID } from '../cad/line-types'
import type { DocFile, Layer, PatternPiece, Shape, StitchHole } from '../cad/cad-types'
import type { WebMcpToolDescriptor, WebMcpModelContext } from './webmcp-api'
import { useWebMcpBridge, type UseWebMcpBridgeParams, type WebMcpBridgeState } from './useWebMcpBridge'
import { WEBMCP_TOOL_NAMES } from './webmcp-tools'

type Registered = { tool: WebMcpToolDescriptor; signal?: AbortSignal }

function stubModelContext() {
  const registered: Registered[] = []
  const context: WebMcpModelContext = {
    registerTool: (tool, options) => {
      registered.push({ tool, signal: options?.signal })
    },
  }
  document.modelContext = context
  return registered
}

function emptyDoc(): DocFile {
  return {
    version: 1,
    units: 'mm',
    documentName: 'Untitled',
    layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, stackLevel: 0 }],
    activeLayerId: 'layer-1',
    lineTypes: createDefaultLineTypes(),
    activeLineTypeId: CUT_LINE_TYPE_ID,
    objects: [],
    foldLines: [],
    stitchHoles: [],
    patternPieces: [],
    seamAllowances: [],
    seamConnections: [],
    hardwareMarkers: [],
  }
}

function createParams() {
  const doc = emptyDoc()
  const calls = {
    setShapes: vi.fn<(value: Shape[] | ((previous: Shape[]) => Shape[])) => void>(),
    setPatternPieces: vi.fn<(value: PatternPiece[] | ((previous: PatternPiece[]) => PatternPiece[])) => void>(),
    setStitchHoles: vi.fn<(value: StitchHole[] | ((previous: StitchHole[]) => StitchHole[])) => void>(),
    setLayers: vi.fn<(value: Layer[] | ((previous: Layer[]) => Layer[])) => void>(),
    setStatus: vi.fn(),
    handleUndo: vi.fn(),
    fitView: vi.fn(),
    exportSvg: vi.fn(),
  }

  const params: UseWebMcpBridgeParams = {
    buildCurrentDocFile: () => doc,
    applyLoadedDocument: vi.fn(),
    setLayers: calls.setLayers,
    setShapes: calls.setShapes,
    setFoldLines: vi.fn(),
    setStitchHoles: calls.setStitchHoles,
    setPatternPieces: calls.setPatternPieces,
    setSeamAllowances: vi.fn(),
    setSeamConnections: vi.fn(),
    setHardwareMarkers: vi.fn(),
    setActiveLayerId: vi.fn(),
    setSelectedShapeIds: vi.fn(),
    setDocumentName: vi.fn(),
    setStatus: calls.setStatus,
    handleUndo: calls.handleUndo,
    fitView: calls.fitView,
    exportHandlers: { svg: calls.exportSvg, pdf: vi.fn(), dxf: vi.fn(), json: vi.fn() },
  }

  return { params, calls }
}

let latestState: WebMcpBridgeState | null = null

function Probe({ params }: { params: UseWebMcpBridgeParams }) {
  const state = useWebMcpBridge(params)
  useEffect(() => {
    latestState = state
  }, [state])
  return null
}

function renderBridge(params: UseWebMcpBridgeParams) {
  latestState = null
  const render = renderForTest(createElement(Probe, { params }))
  return { render, state: () => latestState as WebMcpBridgeState }
}

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
  delete document.modelContext
})

describe('useWebMcpBridge', () => {
  it('registers every published tool with the page model context', async () => {
    const registered = stubModelContext()
    const { params } = createParams()

    const { render, state } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    expect(registered.map((entry) => entry.tool.name)).toEqual([...WEBMCP_TOOL_NAMES])
    expect(state().supported).toBe(true)
    expect(state().registered).toBe(true)
    expect(state().error).toBeNull()
  })

  it('still reports the tool list in a browser without WebMCP, and does not claim to be live', () => {
    const { params } = createParams()
    const { render, state } = renderBridge(params)
    lastRender = render

    expect(state().supported).toBe(false)
    expect(state().registered).toBe(false)
    expect(state().toolNames).toEqual([...WEBMCP_TOOL_NAMES])
  })

  it('unregisters by aborting the signal it registered with', async () => {
    const registered = stubModelContext()
    const { params } = createParams()

    const { render } = renderBridge(params)
    await act(async () => {})
    expect(registered[0].signal?.aborted).toBe(false)

    render.unmount()
    expect(registered.every((entry) => entry.signal?.aborted === true)).toBe(true)
  })

  it('writes a tool call through to the editor state', async () => {
    const registered = stubModelContext()
    const { params, calls } = createParams()

    const { render } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    const create = registered.find((entry) => entry.tool.name === 'create_pattern_piece')
    expect(create).toBeDefined()

    await act(async () => {
      await create?.tool.execute({ shape: 'rounded_rect', name: 'Panel', width_mm: 100, height_mm: 60 })
    })

    const shapes = calls.setShapes.mock.calls.at(-1)?.[0] as Shape[]
    const pieces = calls.setPatternPieces.mock.calls.at(-1)?.[0] as PatternPiece[]
    expect(shapes.length).toBeGreaterThan(3)
    expect(pieces.map((piece) => piece.name)).toEqual(['Panel'])
    expect(calls.setStatus).toHaveBeenCalled()
  })

  it('reads back its own write before React has re-rendered', async () => {
    const registered = stubModelContext()
    const { params } = createParams()

    const { render } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    const tools = new Map(registered.map((entry) => [entry.tool.name, entry.tool]))
    await act(async () => {
      await tools.get('create_pattern_piece')?.execute({
        shape: 'rounded_rect', name: 'First', width_mm: 100, height_mm: 60,
      })
    })

    // `buildCurrentDocFile` still returns the empty document — the stub never
    // applies the setters — so anything the second call sees comes from the
    // write-ahead snapshot rather than from React.
    const overview = await tools.get('get_pattern_overview')?.execute({})
    const summary = JSON.parse(overview?.content[0].text ?? '{}') as { patternPieceCount: number }
    expect(summary.patternPieceCount).toBe(1)
  })

  it('clears the document through the editor rather than around it', async () => {
    const registered = stubModelContext()
    const { params } = createParams()
    const applyLoadedDocument = params.applyLoadedDocument as ReturnType<typeof vi.fn>

    const { render } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    const clear = registered.find((entry) => entry.tool.name === 'clear_document')
    await act(async () => {
      await clear?.tool.execute({})
    })

    expect(applyLoadedDocument).toHaveBeenCalledTimes(1)
    const [doc] = applyLoadedDocument.mock.calls[0] as [{ objects: unknown[]; layers: unknown[] }]
    expect(doc.objects).toHaveLength(0)
    expect(doc.layers).toHaveLength(1)
  })

  it('brings the canvas to the geometry it just drew, once the write has landed', async () => {
    const registered = stubModelContext()
    const { params, calls } = createParams()

    const { render } = renderBridge(params)
    lastRender = render
    await act(async () => {})
    expect(calls.fitView).not.toHaveBeenCalled()

    const create = registered.find((entry) => entry.tool.name === 'create_pattern_piece')
    await act(async () => {
      await create?.tool.execute({ shape: 'rounded_rect', name: 'Panel', width_mm: 100, height_mm: 60 })
    })

    // The pending fit waits for the document to change, which the hook reads
    // as `buildCurrentDocFile` taking a new identity — exactly what the editor's
    // own memo does when a write lands. The stub never applies the setters, so
    // that re-render is staged here.
    render.rerender(
      createElement(Probe, { params: { ...params, buildCurrentDocFile: () => params.buildCurrentDocFile() } }),
    )
    expect(calls.fitView).toHaveBeenCalledTimes(1)
  })

  it('routes an export through the editor exporter', async () => {
    const registered = stubModelContext()
    const { params, calls } = createParams()

    const { render } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    const exportTool = registered.find((entry) => entry.tool.name === 'export_pattern')
    await act(async () => {
      await exportTool?.tool.execute({ format: 'svg' })
    })

    expect(calls.exportSvg).toHaveBeenCalledTimes(1)
  })

  it('reports a registration failure instead of pretending the tools are live', async () => {
    document.modelContext = {
      registerTool: () => {
        throw new Error('registration blocked')
      },
    }
    const { params } = createParams()

    const { render, state } = renderBridge(params)
    lastRender = render
    await act(async () => {})

    expect(state().supported).toBe(true)
    expect(state().registered).toBe(false)
    expect(state().error).toContain('registration blocked')
  })
})
