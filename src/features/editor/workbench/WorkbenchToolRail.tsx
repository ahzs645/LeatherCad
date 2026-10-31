import { useTranslate } from '../hooks/useTranslate'
import { DESKTOP_TOOL_ICON_ITEMS } from '../editor-constants'
import type { Tool } from '../cad/cad-types'
import { useInterfacePreferences } from '../ops/interface-preferences'

type WorkbenchToolRailProps = {
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
}

export function WorkbenchToolRail({ tool, onSetActiveTool }: WorkbenchToolRailProps) {
  const t = useTranslate()
  const preferences = useInterfacePreferences()
  const tools = preferences.toolOrder.flatMap(id => DESKTOP_TOOL_ICON_ITEMS.filter(item => item.value === id))
  return (
    <aside className="workbench-tool-rail" aria-label={t('Geometry tools')}>
      <div className="workbench-tool-rail-grid">
        {tools.map((toolItem) => (
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
            {preferences.toolLabels && <span className="tool-rail-label">{t(toolItem.label)}</span>}
          </button>
        ))}
      </div>
    </aside>
  )
}
