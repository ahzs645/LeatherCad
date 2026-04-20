import { useState, type Dispatch, type SetStateAction } from 'react'
import type {
  AvatarSpec,
  ThreePreviewSettings,
} from '../cad/cad-types'

function defaultAvatarForm() {
  return {
    id: '',
    name: 'Avatar',
    sourceUrl: '',
    scaleMm: 1700,
  } satisfies AvatarSpec
}

function getAvatarFormValue(activeAvatarId: string, avatars: AvatarSpec[]) {
  const activeAvatar = avatars.find((entry) => entry.id === activeAvatarId)
  return activeAvatar ? { ...activeAvatar } : defaultAvatarForm()
}

type AvatarFormFieldsProps = {
  activeAvatarId: string
  avatars: AvatarSpec[]
  onSetAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  onSetThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
}

export function AvatarFormFields({
  activeAvatarId,
  avatars,
  onSetAvatars,
  onSetThreePreviewSettings,
}: AvatarFormFieldsProps) {
  const [avatarForm, setAvatarForm] = useState<AvatarSpec>(() => getAvatarFormValue(activeAvatarId, avatars))

  const handleSaveAvatar = () => {
    const trimmedId = avatarForm.id.trim()
    const trimmedName = avatarForm.name.trim()
    if (!trimmedId || !trimmedName) {
      return
    }

    const nextAvatar: AvatarSpec = {
      id: trimmedId,
      name: trimmedName,
      sourceUrl: avatarForm.sourceUrl.trim(),
      scaleMm: Math.max(200, avatarForm.scaleMm),
    }

    onSetAvatars((previous) => {
      const existingIndex = previous.findIndex((entry) => entry.id === nextAvatar.id)
      if (existingIndex === -1) {
        return [...previous, nextAvatar]
      }
      return previous.map((entry, index) => (index === existingIndex ? nextAvatar : entry))
    })
    onSetThreePreviewSettings((previous) => ({
      ...previous,
      avatarId: nextAvatar.id,
    }))
  }

  const handleDeleteAvatar = () => {
    if (!activeAvatarId) {
      return
    }

    onSetAvatars((previous) => previous.filter((entry) => entry.id !== activeAvatarId))
    onSetThreePreviewSettings((previous) => ({
      ...previous,
      avatarId: previous.avatarId === activeAvatarId ? undefined : previous.avatarId,
    }))
  }

  return (
    <>
      <label className="field-row">
        <span>Avatar ID</span>
        <input
          value={avatarForm.id}
          placeholder="mannequin-a"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, id: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>Name</span>
        <input
          value={avatarForm.name}
          placeholder="Workshop mannequin"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, name: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>glTF/glb URL</span>
        <input
          value={avatarForm.sourceUrl}
          placeholder="https://.../avatar.glb"
          onChange={(event) => setAvatarForm((previous) => ({ ...previous, sourceUrl: event.target.value }))}
        />
      </label>
      <label className="field-row">
        <span>Height (mm)</span>
        <input
          type="number"
          min={200}
          step={10}
          value={avatarForm.scaleMm}
          onChange={(event) =>
            setAvatarForm((previous) => ({
              ...previous,
              scaleMm: Number(event.target.value),
            }))
          }
        />
      </label>
      <div className="button-row">
        <button onClick={handleSaveAvatar}>Save Avatar</button>
        <button onClick={handleDeleteAvatar} disabled={!activeAvatarId}>
          Delete Avatar
        </button>
      </div>
      <p className="hint">Avatar mode loads the selected glTF/GLB asset when a URL is configured. Otherwise the built-in mannequin is used.</p>
    </>
  )
}
