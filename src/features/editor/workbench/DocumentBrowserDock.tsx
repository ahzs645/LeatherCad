import { useTranslate, type Translator } from '../hooks/useTranslate'
import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { DocumentBrowserNode } from './workbench-types'

type DocumentBrowserDockProps = {
  nodes: DocumentBrowserNode[]
  onActivateNode: (node: DocumentBrowserNode, multi: boolean) => void
  onToggleLayerVisibility: (layerId: string) => void
  onToggleLayerGroupVisibility: (layerIds: string[]) => void
  onToggleLayerLock: (layerId: string) => void
  onToggleTracingVisibility: (overlayId: string) => void
  onToggleTracingLock: (overlayId: string) => void
}

function renderNode(
  node: DocumentBrowserNode,
  props: DocumentBrowserDockProps,
  branchOpenState: Record<string, boolean>,
  onToggleBranch: (nodeId: string) => void,
  t: Translator,
  depth = 0,
) {
  const isSection = node.kind === 'section'
  const isSketchBranch = node.kind === 'sketch' && Boolean(node.children?.length)
  const isBranch = node.kind === 'layer-group' || isSketchBranch
  const handleBranchKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const open = branchOpenState[node.id] ?? true
    const branch = event.currentTarget.closest('.workbench-tree-branch')
    if (event.key === 'ArrowRight') {
      if (isBranch && !open) onToggleBranch(node.id)
      else if (isBranch) branch?.querySelector<HTMLButtonElement>('.workbench-tree-children [data-testid^="browser-node-"]')?.focus()
    } else if (isBranch && open) onToggleBranch(node.id)
    else {
      const outer = event.currentTarget.closest('.workbench-tree-node, .workbench-tree-branch')?.parentElement?.closest('.workbench-tree-branch')
      outer?.querySelector<HTMLButtonElement>('.workbench-tree-branch-summary')?.focus()
    }
  }
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    props.onActivateNode(node, event.metaKey || event.ctrlKey)
  }

  const showLayerActions = node.kind === 'layer'
  const showLayerGroupActions = node.kind === 'layer-group'
  const showTracingActions = node.kind === 'tracing-overlay'
  const targetId = node.id.split(':')[1] ?? ''

  if (isSection) {
    return (
      <details key={node.id} className="workbench-tree-section" open>
        <summary>
          <span>{isSection ? t(node.label) : node.label}</span>
          {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
        </summary>
        <div className="workbench-tree-children">
          {(node.children ?? []).map((child) => renderNode(child, props, branchOpenState, onToggleBranch, t, depth + 1))}
        </div>
      </details>
    )
  }

  if (isBranch) {
    const childLayerIds = (node.children ?? [])
      .filter((child) => child.kind === 'layer')
      .map((child) => child.id.split(':')[1] ?? '')
      .filter((layerId) => layerId.length > 0)

    const isOpen = branchOpenState[node.id] ?? true

    return (
      <div
        key={node.id}
        className={`workbench-tree-branch depth-${depth}${node.selected ? ' selected' : ''}${node.dimmed ? ' dimmed' : ''}${isOpen ? ' open' : ' collapsed'}`}
        data-node-kind={node.kind}
        style={depth > 3 ? { marginInlineStart: 8 } : undefined}
      >
        <div className={`workbench-tree-branch-header${isSketchBranch ? ' workbench-sketch-branch-header' : ''}`}>
          {isSketchBranch && <button type="button" className="workbench-tree-disclosure" aria-label={`${t(isOpen ? 'Collapse group' : 'Expand group')}: ${node.label}`} aria-expanded={isOpen} aria-controls={`browser-children-${encodeURIComponent(node.id)}`} onClick={() => onToggleBranch(node.id)} onKeyDown={handleBranchKey}>▸</button>}
          <button
            type="button"
            className="workbench-tree-branch-summary"
            data-testid={`browser-node-${node.id}`}
            onClick={isSketchBranch ? handleClick : () => onToggleBranch(node.id)}
            onKeyDown={handleBranchKey}
            aria-expanded={isSketchBranch ? undefined : isOpen}
            aria-controls={isSketchBranch ? undefined : `browser-children-${encodeURIComponent(node.id)}`}
          >
            {!isSketchBranch && <span className="workbench-tree-branch-chevron" aria-hidden="true">
              ▸
            </span>}
            <span className="workbench-tree-branch-label">{node.label}</span>
            {node.locked && <span role="img" aria-label={t('Locked group')}>🔒</span>}
            {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
          </button>
          {showLayerGroupActions && (
            <span className="workbench-tree-actions workbench-tree-branch-actions">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  props.onToggleLayerGroupVisibility(childLayerIds)
                }}
                title={t('Toggle group visibility')}
              >
                V
              </button>
            </span>
          )}
        </div>
        <div className="workbench-tree-children" id={`browser-children-${encodeURIComponent(node.id)}`} hidden={!isOpen}>
          {(node.children ?? []).map((child) => renderNode(child, props, branchOpenState, onToggleBranch, t, depth + 1))}
        </div>
      </div>
    )
  }

  return (
    <div
      key={node.id}
      className={`workbench-tree-node depth-${depth}${node.selected ? ' selected' : ''}${node.dimmed ? ' dimmed' : ''}`}
      data-node-kind={node.kind}
      style={depth > 3 ? { marginInlineStart: 8 } : undefined}
    >
      <button type="button" className="workbench-tree-node-button" data-testid={`browser-node-${node.id}`} onClick={handleClick} onKeyDown={node.kind === 'sketch' ? handleBranchKey : undefined}>
        <span>{isSection ? t(node.label) : node.label}</span>
        {node.locked && <span role="img" aria-label={t('Locked group')}>🔒</span>}
        {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
      </button>
      {showLayerActions && (
        <div className="workbench-tree-actions">
          <button type="button" onClick={() => props.onToggleLayerVisibility(targetId)} title={t('Toggle layer visibility')}>
            V
          </button>
          <button type="button" onClick={() => props.onToggleLayerLock(targetId)} title={t('Toggle layer lock')}>
            L
          </button>
        </div>
      )}
      {showTracingActions && (
        <div className="workbench-tree-actions">
          <button type="button" onClick={() => props.onToggleTracingVisibility(targetId)} title={t('Toggle tracing visibility')}>
            V
          </button>
          <button type="button" onClick={() => props.onToggleTracingLock(targetId)} title={t('Toggle tracing lock')}>
            L
          </button>
        </div>
      )}
      {node.children && node.children.length > 0 && (
        <div className="workbench-tree-children">
          {node.children.map((child) => renderNode(child, props, branchOpenState, onToggleBranch, t, depth + 1))}
        </div>
      )}
    </div>
  )
}

export function DocumentBrowserDock(props: DocumentBrowserDockProps) {
  const t = useTranslate()
  const [branchOpenState, setBranchOpenState] = useState<Record<string, boolean>>({})

  const handleToggleBranch = (nodeId: string) => {
    setBranchOpenState((previous) => ({
      ...previous,
      [nodeId]: !(previous[nodeId] ?? true),
    }))
  }

  return (
    <aside className="workbench-browser-dock" aria-label={t('Document browser')}>
      <div className="workbench-browser-header">
        <h2>{t('Document')}</h2>
        <p>{t('Pieces, layers, sketches, tracing, and 3D assets')}</p>
      </div>
      <div className="workbench-browser-tree">
        {props.nodes.map((node) => renderNode(node, props, branchOpenState, handleToggleBranch, t))}
      </div>
    </aside>
  )
}
