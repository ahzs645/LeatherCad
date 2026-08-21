import { useEffect } from 'react'
import type { Point, Tool } from '../../cad/cad-types'
import { executeToolCommand, executeToolPointerDown, getToolHint, resetToolSession } from '../../tools/tool-executor'
import { useEditorToolSession } from '../../state/providers/EditorToolSessionProvider'
import type { ToolRuntime } from '../../tools/tool-types'

type UseCanvasToolExecutionParams = {
  tool: Tool
  createToolRuntime: () => ToolRuntime
  setStatus: (status: string) => void
}

export function useCanvasToolExecution({ tool, createToolRuntime, setStatus }: UseCanvasToolExecutionParams) {
  // Shared with the 3D preview so a seam can be started in one view and
  // finished in the other.
  const toolSession = useEditorToolSession()

  useEffect(() => {
    resetToolSession(toolSession, tool)
  }, [tool, toolSession])

  const handleToolPointerDown = (point: Point) => {
    executeToolPointerDown(tool, point, createToolRuntime())
  }

  const runPrecisionCommand = (command: string) => {
    const message = executeToolCommand(tool, command, createToolRuntime())
    setStatus(message)
    return message
  }

  return {
    toolSession,
    handleToolPointerDown,
    runPrecisionCommand,
    getToolHint: (draftPoints: Point[]) => getToolHint(tool, draftPoints),
  }
}
