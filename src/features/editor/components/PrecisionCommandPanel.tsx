import { useEffect, useRef, useState, type FormEvent } from 'react'

type PrecisionCommandPanelProps = {
  open: boolean
  onClose: () => void
  toolHint: string | null
  onRunCommand: (command: string) => string
  variant?: 'modal' | 'drawer'
}

type CommandLogLine = {
  id: number
  command: string
  result: string
}

export function PrecisionCommandPanel({
  open,
  onClose,
  toolHint,
  onRunCommand,
  variant = 'modal',
}: PrecisionCommandPanelProps) {
  const [command, setCommand] = useState('')
  const [logs, setLogs] = useState<CommandLogLine[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

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

  const panel = (
    <section
      className={`precision-panel ${variant === 'drawer' ? 'precision-drawer' : 'precision-modal'}`}
      role="dialog"
      aria-modal={variant === 'modal' ? 'true' : 'false'}
      aria-label="Precision input"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="precision-modal-header">
        <h2>Precision Input</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <form className="precision-form" onSubmit={run}>
        <input
          ref={inputRef}
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

  if (variant === 'drawer') {
    return panel
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      {panel}
    </div>
  )
}
