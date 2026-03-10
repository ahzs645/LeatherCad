import type { RibbonCommandGroup } from './workbench-types'
import { WorkbenchIcon, resolveRibbonCommandIcon } from './workbench-icons'

type WorkbenchRibbonProps = {
  groups: RibbonCommandGroup[]
  onInvokeCommand: (commandId: string) => void
}

export function WorkbenchRibbon({
  groups,
  onInvokeCommand,
}: WorkbenchRibbonProps) {
  return (
    <section className="workbench-ribbon">
      <div className="workbench-ribbon-groups">
        {groups.map((group) => (
          <section key={group.id} className="workbench-ribbon-group" aria-label={group.title}>
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
                  <span className="workbench-ribbon-command-label">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="workbench-ribbon-group-title">{group.title}</div>
          </section>
        ))}
      </div>
    </section>
  )
}
