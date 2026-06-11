import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'

type PrecisionCommandPanelProps = {
  open: boolean
  onClose: () => void
  toolHint: string | null
  onRunCommand: (command: string) => string
  variant?: 'modal' | 'drawer' | 'strip'
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
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isStrip = variant === 'strip'

  useEffect(() => {
    if (!open || isStrip) {
      return
    }
    inputRef.current?.focus()
  }, [isStrip, open])

  useEffect(() => {
    if (!open || isStrip) {
      return
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStrip, open, onClose])

  if (!open && !isStrip) {
    return null
  }

  const run = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = command.trim() || history[0] || ''
    if (!trimmed) {
      return
    }
    const result = onRunCommand(trimmed)
    setHistory((previous) => [trimmed, ...previous.filter((entry) => entry !== trimmed)].slice(0, 30))
    setHistoryIndex(null)
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

  const handleCommandKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (history.length === 0) return
      const nextIndex = historyIndex === null ? 0 : Math.min(history.length - 1, historyIndex + 1)
      setHistoryIndex(nextIndex)
      setCommand(history[nextIndex])
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (history.length === 0 || historyIndex === null) return
      const nextIndex = historyIndex - 1
      if (nextIndex < 0) {
        setHistoryIndex(null)
        setCommand('')
        return
      }
      setHistoryIndex(nextIndex)
      setCommand(history[nextIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      if (command.trim()) {
        setCommand('')
        setHistoryIndex(null)
        return
      }
      const result = onRunCommand('finish')
      setLogs((previous) => [
        {
          id: Date.now(),
          command: 'finish',
          result,
        },
        ...previous,
      ].slice(0, 6))
      if (!isStrip) {
        onClose()
      }
    }
  }

  const panel = (
    <section
      className={`precision-panel ${variant === 'drawer' ? 'precision-drawer' : isStrip ? 'precision-strip' : 'precision-modal'}`}
      role={isStrip ? 'search' : 'dialog'}
      aria-modal={variant === 'modal' ? 'true' : undefined}
      aria-label={isStrip ? 'CAD command line' : 'Precision input'}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {!isStrip && (
        <div className="precision-modal-header">
          <h2>Precision Input</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      )}
      <form className="precision-form" onSubmit={run}>
        {isStrip && <span className="precision-strip-prompt">Command</span>}
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(event) => {
            setCommand(event.target.value)
            setHistoryIndex(null)
          }}
          onKeyDown={handleCommandKeyDown}
          placeholder={isStrip ? "l, rect, offset 3, mirror h, trim, extend, x,y" : "x,y  |  @x,y  |  r<deg"}
          aria-label={isStrip ? 'CAD command input' : 'Precision command input'}
        />
        <button type="submit">Run</button>
      </form>
      {!isStrip && <p className="precision-help">Commands: `help`, `finish`, `x,y`, `@x,y`, `r&lt;deg`</p>}
      {toolHint && <p className="precision-hint">{toolHint}</p>}
      {logs.length > 0 && !isStrip && (
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

  if (variant === 'drawer' || isStrip) {
    return panel
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      {panel}
    </div>
  )
}
