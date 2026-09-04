/**
 * What the person sees while an agent is using the page.
 *
 * An agent that edits the canvas silently is worse than one that cannot edit
 * it at all: the user loses track of their own document. So the tools the page
 * publishes are listed here, and every call the agent makes lands in a log the
 * user can read, with the arguments it used and what came back. The panel also
 * carries its own weight when no agent is present — it is where you find out
 * that this browser has no WebMCP support, and what to do about it.
 */

import { useState, useSyncExternalStore } from 'react'
import {
  clearWebMcpActivity,
  getWebMcpActivitySnapshot,
  subscribeToWebMcpActivity,
  type WebMcpActivityEntry,
} from './webmcp-activity'
import type { WebMcpBridgeState } from './useWebMcpBridge'

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ActivityRow({ entry }: { entry: WebMcpActivityEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`webmcp-activity webmcp-activity-${entry.status}`}>
      <button
        type="button"
        className="webmcp-activity-head"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
      >
        <span className="webmcp-activity-name">{entry.toolName}</span>
        <span className="webmcp-activity-time">{formatTime(entry.at)}</span>
      </button>
      <p className="webmcp-activity-summary">{entry.summary}</p>
      {open ? <pre className="webmcp-activity-detail">{entry.detail}</pre> : null}
    </li>
  )
}

export type WebMcpPanelProps = {
  state: WebMcpBridgeState
}

export function WebMcpPanel({ state }: WebMcpPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const entries = useSyncExternalStore(
    subscribeToWebMcpActivity,
    getWebMcpActivitySnapshot,
    getWebMcpActivitySnapshot,
  )

  const status = state.error
    ? { tone: 'error', label: 'Registration failed' }
    : state.registered
      ? { tone: 'live', label: 'Agent tools live' }
      : { tone: 'idle', label: 'No WebMCP in this browser' }

  return (
    <section className={`webmcp-panel webmcp-panel-${status.tone}`} aria-label="Agent tools">
      <button
        type="button"
        className="webmcp-panel-head"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
      >
        <span className={`webmcp-dot webmcp-dot-${status.tone}`} aria-hidden="true" />
        <span className="webmcp-panel-title">{status.label}</span>
        <span className="webmcp-panel-count">
          {state.toolNames.length} tools
          {entries.length > 0 ? ` · ${entries.length} calls` : ''}
        </span>
        <span className="webmcp-panel-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div className="webmcp-panel-body">
          {state.error ? <p className="webmcp-note webmcp-note-error">{state.error}</p> : null}
          {!state.registered && !state.error ? (
            <p className="webmcp-note">
              This page publishes its tools through WebMCP. To use them, open it in ChatGPT&apos;s in-app
              browser, or in Chrome with <code>chrome://flags/#enable-webmcp-testing</code> enabled.
            </p>
          ) : null}
          {state.registered ? (
            <p className="webmcp-note">
              An agent can read, draw, measure and check this pattern with you. Everything it does shows
              up here and on the canvas.
            </p>
          ) : null}

          <ul className="webmcp-tool-list">
            {state.toolNames.map((name) => (
              <li key={name} className="webmcp-tool-chip">
                {name}
              </li>
            ))}
          </ul>

          <div className="webmcp-log-head">
            <h3>Agent activity</h3>
            {entries.length > 0 ? (
              <button type="button" className="webmcp-clear" onClick={clearWebMcpActivity}>
                Clear
              </button>
            ) : null}
          </div>
          {entries.length === 0 ? (
            <p className="webmcp-note webmcp-note-quiet">No tool calls yet.</p>
          ) : (
            <ul className="webmcp-log">
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
