import { useTranslate } from '../hooks/useTranslate'
import { DESKTOP_TOOL_ICON_ITEMS } from '../editor-constants'
import type { Tool } from '../cad/cad-types'

type WorkbenchToolRailProps = {
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
}

export function WorkbenchToolRail({ tool, onSetActiveTool }: WorkbenchToolRailProps) {
  const t = useTranslate()
  return (
    <aside className="workbench-tool-rail" aria-label={t('Geometry tools')}>
      <div className="workbench-tool-rail-grid">
        {DESKTOP_TOOL_ICON_ITEMS.map((toolItem) => (
          <button
            key={toolItem.value}
            type="button"
            className={tool === toolItem.value ? 'tool-icon-button active' : 'tool-icon-button'}
            onClick={() => onSetActiveTool(toolItem.value)}
            title={t(toolItem.label)}
            aria-label={t(toolItem.label)}
            data-tooltip={t(toolItem.label)}
          >
            <span className="tool-icon-badge" aria-hidden="true">
              <img src={toolItem.iconSrc} alt="" />
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
