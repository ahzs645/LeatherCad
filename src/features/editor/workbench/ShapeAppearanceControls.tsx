import { useMemo, useState } from 'react'
import type { Shape } from '../cad/cad-types'
import { buildGroupAccess, isShapeLocked, validateGroupHierarchy } from '../ops/shape-access'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useOptionalEditorLayers } from '../state/providers/EditorLayerStateProvider'
import { useTranslate } from '../hooks/useTranslate'

export function ShapeAppearanceControls({ shape }: { shape: Shape }) {
  const t = useTranslate()
  const { setShapes, setSketchGroups } = useEditorDocumentActions()
  const groups = useEditorDocumentSelector(state => state.sketchGroups)
  const actual = useEditorDocumentSelector(state => state.shapes.find(item => item.id === shape.id)) ?? shape
  const access = useMemo(() => buildGroupAccess(groups), [groups])
  const group = groups.find(item => item.id === actual.groupId)
  const inheritedLock = group ? access[group.id]?.locked === true : false
  const [error, setError] = useState('')
  const layers = useOptionalEditorLayers()
  const layerLocked = layers?.some(layer => layer.id === actual.layerId && layer.locked) === true
  const updateParent = (parentId: string) => {
    if (!group) return
    const next = groups.map(item => item.id === group.id ? { ...item, parentId: parentId || undefined } : item)
    try {
      validateGroupHierarchy(next)
      setSketchGroups(next)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('shape.groupInvalid', 'Invalid group parent')) }
  }
  return <div className="control-block">
    <h3>{t('shape.appearance', 'Appearance and protection')}</h3>
    <label className="checkbox-row">
      <input type="checkbox" checked={actual.locked === true} onChange={event => {
        const locked = event.target.checked
        setShapes(previous => previous.map(item => item.id === actual.id ? { ...item, locked } : item))
      }} />
      {t('shape.lock', 'Lock shape')}
    </label>
    {inheritedLock ? <p className="hint">{t('shape.inheritedLock', 'This shape is also protected by its group. Unlock the group to edit it.')}</p> : null}
    <label className="field-row">
      <span>{t('shape.opacity', 'Opacity (%)')}</span>
      <input aria-label={t('shape.opacity', 'Opacity (%)')} type="number" min={0} max={100} step={1} value={Math.round((actual.opacity ?? 1) * 100)} disabled={isShapeLocked(actual, access) || layerLocked} onChange={event => {
        if (!event.target.value.trim()) return
        const value = Number(event.target.value)
        if (!Number.isFinite(value) || value < 0 || value > 100) return
        setShapes(previous => previous.map(item => item.id === actual.id ? { ...item, opacity: value / 100 } : item))
      }} />
    </label>
    {group ? <label className="field-row">
      <span>{t('shape.parentGroup', 'Group parent')}</span>
      <select value={group.parentId ?? ''} onChange={event => updateParent(event.target.value)}>
        <option value="">{t('shape.noParent', 'No parent group')}</option>
        {groups.filter(item => item.id !== group.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
}
