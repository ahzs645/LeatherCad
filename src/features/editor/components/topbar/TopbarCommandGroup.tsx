import type { TopbarSection } from '../../modules/topbar/topbar-command-model'

type TopbarCommandGroupProps = {
  section: TopbarSection
  className: string
}

export function TopbarCommandGroup({ section, className }: TopbarCommandGroupProps) {
  return (
    <div className={className} data-section={section.label}>
      {section.commands.map((command) => (
        <button
          key={command.id}
          onClick={command.run}
          disabled={command.disabled}
          title={command.title}
        >
          {command.label}
        </button>
      ))}
    </div>
  )
}
