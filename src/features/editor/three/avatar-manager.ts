import {
  Box3,
  BufferGeometry,
  CapsuleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'
import type { AvatarSpec, ThreePreviewSettings } from '../cad/cad-types'
import { clearGroup, disposeObjectGraph } from './bridge/scene-lifecycle'

const EPSILON = 1e-6

type RebuildAvatarModelParams = {
  avatarGroup: Group
  avatars: AvatarSpec[]
  previewSettings: ThreePreviewSettings
  transformScale: number
  preservedMaterials: Set<MeshStandardMaterial | import('three').Material>
  fitControlsToModel: () => void
}

export class ThreeAvatarManager {
  private avatarLoadVersion = 0

  private createProceduralAvatar(scaleWorld: number) {
    const avatar = new Group()
    const material = new MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 0.28,
    })

    const torso = new Mesh(new CapsuleGeometry(0.14 * scaleWorld, 0.55 * scaleWorld, 8, 12), material)
    torso.position.set(0, 0.45 * scaleWorld, 0)
    avatar.add(torso)

    const head = new Mesh(new SphereGeometry(0.12 * scaleWorld, 16, 16), material)
    head.position.set(0, 0.92 * scaleWorld, 0)
    avatar.add(head)

    const leftLeg = new Mesh(new CapsuleGeometry(0.05 * scaleWorld, 0.46 * scaleWorld, 6, 10), material)
    leftLeg.position.set(-0.08 * scaleWorld, 0.03 * scaleWorld, 0)
    avatar.add(leftLeg)

    const rightLeg = leftLeg.clone()
    rightLeg.position.x *= -1
    avatar.add(rightLeg)

    const leftArm = new Mesh(new CapsuleGeometry(0.04 * scaleWorld, 0.42 * scaleWorld, 6, 10), material)
    leftArm.position.set(-0.27 * scaleWorld, 0.53 * scaleWorld, 0)
    leftArm.rotation.z = MathUtils.degToRad(22)
    avatar.add(leftArm)

    const rightArm = leftArm.clone()
    rightArm.position.x *= -1
    rightArm.rotation.z *= -1
    avatar.add(rightArm)

    return avatar
  }

  private activeAvatarSpec(avatars: AvatarSpec[], previewSettings: ThreePreviewSettings) {
    if (previewSettings.avatarId) {
      const match = avatars.find((entry) => entry.id === previewSettings.avatarId)
      if (match) {
        return match
      }
    }
    return avatars[0] ?? null
  }

  private styleLoadedAvatar(root: Object3D) {
    root.traverse((object) => {
      const mesh = object as Mesh
      if (!(mesh.geometry instanceof BufferGeometry)) {
        return
      }

      const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const material =
        sourceMaterial instanceof MeshStandardMaterial
          ? sourceMaterial.clone()
          : new MeshStandardMaterial({
              color: '#94a3b8',
              roughness: 0.92,
              metalness: 0.04,
            })
      material.transparent = true
      material.opacity = Math.min(material.opacity ?? 1, 0.34)
      material.depthWrite = false
      mesh.material = material
    })
  }

  private async loadAvatarAsset(spec: AvatarSpec, transformScale: number) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    const loaded = await loader.loadAsync(spec.sourceUrl)
    const avatar = loaded.scene.clone(true)
    this.styleLoadedAvatar(avatar)

    const bounds = new Box3().setFromObject(avatar)
    const size = bounds.getSize(new Vector3())
    const safeHeight = Math.max(size.y, EPSILON)
    const targetHeight = Math.max(spec.scaleMm, 200) * transformScale
    const scale = targetHeight / safeHeight
    avatar.scale.setScalar(scale)

    const scaledBounds = new Box3().setFromObject(avatar)
    avatar.position.set(0, -scaledBounds.min.y, 0)
    return avatar
  }

  async rebuildAvatarModel({
    avatarGroup,
    avatars,
    previewSettings,
    transformScale,
    preservedMaterials,
    fitControlsToModel,
  }: RebuildAvatarModelParams) {
    const version = ++this.avatarLoadVersion
    clearGroup(avatarGroup, preservedMaterials)

    if (previewSettings.mode !== 'avatar') {
      return
    }

    const spec = this.activeAvatarSpec(avatars, previewSettings)
    if (!spec?.sourceUrl.trim()) {
      const fallback = this.createProceduralAvatar(1.05)
      fallback.position.set(0, 0.22, 0)
      avatarGroup.add(fallback)
      fitControlsToModel()
      return
    }

    try {
      const avatar = await this.loadAvatarAsset(spec, transformScale)
      if (version !== this.avatarLoadVersion || previewSettings.mode !== 'avatar') {
        disposeObjectGraph(avatar, preservedMaterials)
        return
      }
      avatarGroup.add(avatar)
      fitControlsToModel()
    } catch {
      if (version !== this.avatarLoadVersion || previewSettings.mode !== 'avatar') {
        return
      }
      const fallback = this.createProceduralAvatar(1.05)
      fallback.position.set(0, 0.22, 0)
      avatarGroup.add(fallback)
      fitControlsToModel()
    }
  }

  invalidate() {
    this.avatarLoadVersion += 1
  }
}
