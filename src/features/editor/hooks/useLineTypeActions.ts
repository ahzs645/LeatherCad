import type { Dispatch, SetStateAction } from 'react'
import type { LineType, Shape } from '../cad/cad-types'
import { applyLineTypeToShapeIds } from '../ops/line-type-ops'
import { normalizeHexColor } from '../editor-utils'

type UseLineTypeActionsParams = {
  activeLineType: LineType | null
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLineTypeActions(params: UseLineTypeActionsParams) {
  const {
    activeLineType,
    shapes,
    selectedShapeIdSet,
    setLineTypes,
    setShapes,
    setSelectedShapeIds,
    setStatus,
  } = params

  const handleToggleActiveLineTypeVisibility = () => {
    if (!activeLineType) {
      setStatus('No active line type to update')
      return
    }

    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              visible: !lineType.visible,
            }
          : lineType,
      ),
    )

    setStatus(activeLineType.visible ? `Line type hidden: ${activeLineType.name}` : `Line type shown: ${activeLineType.name}`)
  }

  const handleShowAllLineTypes = () => {
    setLineTypes((previous) => previous.map((lineType) => ({ ...lineType, visible: true })))
    setStatus('All line types shown')
  }

  const handleIsolateActiveLineType = () => {
    if (!activeLineType) {
      setStatus('No active line type to isolate')
      return
    }

    setLineTypes((previous) =>
      previous.map((lineType) => ({
        ...lineType,
        visible: lineType.id === activeLineType.id,
      })),
    )
    setStatus(`Isolated line type: ${activeLineType.name}`)
  }

  const handleUpdateActiveLineTypeRole = (role: LineType['role']) => {
    if (!activeLineType) {
      return
    }
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              role,
            }
          : lineType,
      ),
    )
    setStatus(`Line type role set to ${role}`)
  }

  const handleUpdateActiveLineTypeStyle = (style: LineType['style']) => {
    if (!activeLineType) {
      return
    }
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              style,
            }
          : lineType,
      ),
    )
    setStatus(`Line type style set to ${style}`)
  }

  const handleUpdateActiveLineTypeColor = (color: string) => {
    if (!activeLineType) {
      return
    }
    const normalized = normalizeHexColor(color, activeLineType.color)
    setLineTypes((previous) =>
      previous.map((lineType) =>
        lineType.id === activeLineType.id
          ? {
              ...lineType,
              color: normalized,
            }
          : lineType,
      ),
    )
  }

  const handleSelectShapesByActiveLineType = () => {
    if (!activeLineType) {
      return
    }

    const nextSelected = shapes.filter((shape) => shape.lineTypeId === activeLineType.id).map((shape) => shape.id)
    setSelectedShapeIds(nextSelected)
    setStatus(`Selected ${nextSelected.length} shapes on ${activeLineType.name}`)
  }

  const handleAssignSelectedToActiveLineType = () => {
    if (!activeLineType) {
      return
    }

    if (selectedShapeIdSet.size === 0) {
      setStatus('No selected shapes to assign')
      return
    }

    setShapes((previous) => applyLineTypeToShapeIds(previous, selectedShapeIdSet, activeLineType.id))
    setStatus(`Assigned ${selectedShapeIdSet.size} selected shapes to ${activeLineType.name}`)
  }

  const handleClearShapeSelection = () => {
    setSelectedShapeIds([])
    setStatus('Shape selection cleared')
  }

  const handleLinePaletteSelectAll = (lineTypes: LineType[]) => {
    const visibleIds = new Set(lineTypes.filter((lineType) => lineType.visible).map((lineType) => lineType.id))
    if (visibleIds.size === 0) {
      setSelectedShapeIds([])
      setStatus('No visible line types to select')
      return
    }
    const nextSelected = shapes.filter((shape) => visibleIds.has(shape.lineTypeId)).map((shape) => shape.id)
    setSelectedShapeIds(nextSelected)
    setStatus(`Selected ${nextSelected.length} shape${nextSelected.length === 1 ? '' : 's'} on visible line types`)
  }

  const handleLinePaletteUnselectLineType = (lineTypeId: string) => {
    const removedIds = new Set(
      shapes.filter((shape) => shape.lineTypeId === lineTypeId).map((shape) => shape.id),
    )
    if (removedIds.size === 0) {
      setStatus('No shapes on that line type to deselect')
      return
    }
    setSelectedShapeIds((previous) => previous.filter((id) => !removedIds.has(id)))
    setStatus(`Deselected shapes on line type`)
  }

  const handleLinePaletteUnselectOthers = (lineTypeId: string) => {
    const keepIds = new Set(
      shapes.filter((shape) => shape.lineTypeId === lineTypeId).map((shape) => shape.id),
    )
    setSelectedShapeIds((previous) => previous.filter((id) => keepIds.has(id)))
    setStatus('Kept only shapes on the chosen line type selected')
  }

  return {
    handleToggleActiveLineTypeVisibility,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
    handleLinePaletteSelectAll,
    handleLinePaletteUnselectLineType,
    handleLinePaletteUnselectOthers,
  }
}
