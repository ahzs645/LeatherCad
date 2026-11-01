import { useTranslate } from '../hooks/useTranslate'
import type { RibbonCommandGroup } from './workbench-types'
import { WorkbenchIcon } from './workbench-icons'
import { resolveRibbonCommandIcon } from './workbench-icon-resolvers'

type WorkbenchRibbonProps = {
  groups: RibbonCommandGroup[]
  onInvokeCommand: (commandId: string) => void
  /** Hide the ribbon; the header tabs bring it back. */
  onCollapse?: () => void
}

export function WorkbenchRibbon({
  groups,
  onInvokeCommand,
  onCollapse,
}: WorkbenchRibbonProps) {
  const t = useTranslate()
  return (
    <section className="workbench-ribbon">
      <div className="workbench-ribbon-groups">
        {groups.map((group) => (
          <section key={group.id} className="workbench-ribbon-group" aria-label={t(group.title)}>
            <div className="workbench-ribbon-buttons">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="workbench-ribbon-command"
                  data-testid={`ribbon-command-${item.id}`}
                  disabled={item.disabled}
                  onClick={() => onInvokeCommand(item.id)}
                >
                  <span className="workbench-ribbon-command-icon" aria-hidden="true">
                    <WorkbenchIcon name={resolveRibbonCommandIcon(item)} />
                  </span>
                  <span className="workbench-ribbon-command-label">{t(item.label)}</span>
                </button>
              ))}
            </div>
            <div className="workbench-ribbon-group-title">{t(group.title)}</div>
          </section>
        ))}
      </div>
      {onCollapse && (
        <button
          type="button"
          className="workbench-ribbon-collapse"
          data-testid="workbench-ribbon-collapse"
          aria-label={t('Hide the ribbon (click a tab to show it again)')}
          title={t('Hide the ribbon (click a tab to show it again)')}
          onClick={onCollapse}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </section>
  )
}
