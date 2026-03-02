import { useState, type FormEvent } from 'react'

type PrecisionCommandPanelProps = {
  toolHint: string | null
  onRunCommand: (command: string) => string
}

type CommandLogLine = {
  id: number
  command: string
  result: string
}

export function PrecisionCommandPanel({ toolHint, onRunCommand }: PrecisionCommandPanelProps) {
  const [command, setCommand] = useState('')
  const [logs, setLogs] = useState<CommandLogLine[]>([])

  const run = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = command.trim()
    if (!trimmed) {
      return
    }
    const result = onRunCommand(trimmed)
    setLogs((previous) => [
      {
        id: Date.now(),
        command: trimmed,
        result,
      },
      ...previous,
    ].slice(0, 6))
    setCommand('')
  }

  return (
    <section className="precision-panel">
      <div className="precision-panel-title">Precision Input</div>
      <form className="precision-form" onSubmit={run}>
        <input
          type="text"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="x,y  |  @x,y  |  r<deg"
          aria-label="Precision command input"
        />
        <button type="submit">Run</button>
      </form>
      <p className="precision-help">Commands: `help`, `finish`, `x,y`, `@x,y`, `r&lt;deg`</p>
      {toolHint && <p className="precision-hint">{toolHint}</p>}
      {logs.length > 0 && (
        <div className="precision-log">
          {logs.map((line) => (
            <div key={line.id} className="precision-log-line">
              <span className="precision-log-command">&gt; {line.command}</span>
              <span className="precision-log-result">{line.result}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
