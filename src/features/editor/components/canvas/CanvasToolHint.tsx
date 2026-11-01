import type { Tool } from '../../cad/cad-types'
import { toolLabel } from '../../editor-utils'
import { useTranslate } from '../../hooks/useTranslate'
import { TOOL_IDLE_HINTS, toolShortcutLabel } from '../../ops/tool-shortcuts'

type CanvasToolHintProps = {
  tool: Tool
  hint: string | null
  selectionCount: number
}

/** Tool name, shortcut and next step, pinned to the drawing area's top-left corner. */
export function CanvasToolHint({ tool, hint, selectionCount }: CanvasToolHintProps) {
  const t = useTranslate()
  const shortcut = toolShortcutLabel(tool)
  const step = hint
    ?? (tool === 'pan' && selectionCount > 0
      ? t('{count} selected · Enter edits size and position').replace('{count}', String(selectionCount))
      : t(TOOL_IDLE_HINTS[tool]))
  return (
    <div className="canvas-tool-hint" role="status" aria-live="polite" data-testid="canvas-tool-hint">
      <strong>{t(toolLabel(tool))}</strong>
      {shortcut && <kbd>{shortcut}</kbd>}
      <span aria-hidden="true">·</span>
      <span>{hint ? t(hint) : step}</span>
    </div>
  )
}
