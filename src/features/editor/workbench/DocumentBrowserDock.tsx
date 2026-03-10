import type { MouseEvent } from 'react'
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
  depth = 0,
) {
  const isSection = node.kind === 'section'
  const isBranch = node.kind === 'layer-group'
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
          <span>{node.label}</span>
          {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
        </summary>
        <div className="workbench-tree-children">
          {(node.children ?? []).map((child) => renderNode(child, props, depth + 1))}
        </div>
      </details>
    )
  }

  if (isBranch) {
    const childLayerIds = (node.children ?? [])
      .filter((child) => child.kind === 'layer')
      .map((child) => child.id.split(':')[1] ?? '')
      .filter((layerId) => layerId.length > 0)

    return (
      <details
        key={node.id}
        className={`workbench-tree-branch depth-${depth}${node.selected ? ' selected' : ''}${node.dimmed ? ' dimmed' : ''}`}
        data-node-kind={node.kind}
        open
      >
        <summary>
          <span className="workbench-tree-branch-label">{node.label}</span>
          {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
          {showLayerGroupActions && (
            <span className="workbench-tree-actions workbench-tree-branch-actions">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  props.onToggleLayerGroupVisibility(childLayerIds)
                }}
                title="Toggle group visibility"
              >
                V
              </button>
            </span>
          )}
        </summary>
        <div className="workbench-tree-children">
          {(node.children ?? []).map((child) => renderNode(child, props, depth + 1))}
        </div>
      </details>
    )
  }

  return (
    <div
      key={node.id}
      className={`workbench-tree-node depth-${depth}${node.selected ? ' selected' : ''}${node.dimmed ? ' dimmed' : ''}`}
      data-node-kind={node.kind}
    >
      <button type="button" className="workbench-tree-node-button" data-testid={`browser-node-${node.id}`} onClick={handleClick}>
        <span>{node.label}</span>
        {node.meta && <span className="workbench-tree-meta">{node.meta}</span>}
      </button>
      {showLayerActions && (
        <div className="workbench-tree-actions">
          <button type="button" onClick={() => props.onToggleLayerVisibility(targetId)} title="Toggle layer visibility">
            V
          </button>
          <button type="button" onClick={() => props.onToggleLayerLock(targetId)} title="Toggle layer lock">
            L
          </button>
        </div>
      )}
      {showTracingActions && (
        <div className="workbench-tree-actions">
          <button type="button" onClick={() => props.onToggleTracingVisibility(targetId)} title="Toggle tracing visibility">
            V
          </button>
          <button type="button" onClick={() => props.onToggleTracingLock(targetId)} title="Toggle tracing lock">
            L
          </button>
        </div>
      )}
      {node.children && node.children.length > 0 && (
        <div className="workbench-tree-children">
          {node.children.map((child) => renderNode(child, props, depth + 1))}
        </div>
      )}
    </div>
  )
}

export function DocumentBrowserDock(props: DocumentBrowserDockProps) {
  return (
    <aside className="workbench-browser-dock" aria-label="Document browser">
      <div className="workbench-browser-header">
        <h2>Document</h2>
        <p>Pieces, layers, sketches, tracing, and 3D assets</p>
      </div>
      <div className="workbench-browser-tree">
        {props.nodes.map((node) => renderNode(node, props))}
      </div>
    </aside>
  )
}
