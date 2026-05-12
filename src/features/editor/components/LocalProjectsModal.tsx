import { useEffect, useMemo, useState } from 'react'
import type { StoredEditorDocument } from '../localdb/app-data-client'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'

type LocalProjectsModalProps = {
  open: boolean
  activeLocalDocumentId: string | null
  onClose: () => void
  onSaveCurrent: () => Promise<void>
  onLoadProject: (documentId: string) => Promise<void>
  onDeleteProject: (documentId: string) => Promise<void>
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function projectMeta(project: StoredEditorDocument) {
  const shapeCount = project.doc.objects.length
  const layerCount = project.doc.layers.length
  return `${shapeCount} shape${shapeCount === 1 ? '' : 's'}, ${layerCount} layer${layerCount === 1 ? '' : 's'}`
}

export function LocalProjectsModal({
  open,
  activeLocalDocumentId,
  onClose,
  onSaveCurrent,
  onLoadProject,
  onDeleteProject,
}: LocalProjectsModalProps) {
  const [projects, setProjects] = useState<StoredEditorDocument[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeLocalDocumentId)
  const [loading, setLoading] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const refreshProjects = async () => {
    setLoading(true)
    const nextProjects = await withEditorLocalDataClient((client) => client.documents.list())
    setProjects(nextProjects ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!open) {
      return
    }
    setSelectedProjectId(activeLocalDocumentId)
    void refreshProjects()
  }, [activeLocalDocumentId, open])

  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      role="presentation"
    >
      <div className="line-type-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="line-type-modal-header">
          <h2>Local Projects</h2>
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">Open, save, or remove projects stored in this browser.</p>

        <div className="line-type-modal-actions">
          <button
            onClick={() => {
              void onSaveCurrent().then(refreshProjects)
            }}
          >
            Save Current Project
          </button>
          <button onClick={() => void refreshProjects()}>Refresh</button>
        </div>

        <div className="template-list">
          {loading ? (
            <p className="hint">Loading local projects...</p>
          ) : projects.length === 0 ? (
            <p className="hint">No local projects saved yet.</p>
          ) : (
            projects.map((project) => (
              <label key={project.id} className="template-item">
                <input
                  type="radio"
                  name="local-project"
                  checked={selectedProjectId === project.id}
                  onChange={() => setSelectedProjectId(project.id)}
                />
                <span className="template-item-name">
                  {project.name}
                  {activeLocalDocumentId === project.id ? ' (current)' : ''}
                </span>
                <span className="template-item-meta">
                  {projectMeta(project)} · updated {formatDate(project.updatedAt)}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="line-type-modal-actions">
          <button
            onClick={() => {
              if (!selectedProject) {
                return
              }
              void onLoadProject(selectedProject.id).then(onClose)
            }}
            disabled={!selectedProject}
          >
            Open Project
          </button>
          <button
            onClick={() => {
              if (!selectedProject) {
                return
              }
              void onDeleteProject(selectedProject.id).then(() => {
                setSelectedProjectId(null)
                return refreshProjects()
              })
            }}
            disabled={!selectedProject}
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  )
}
