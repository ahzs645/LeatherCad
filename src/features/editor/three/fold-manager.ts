import { Box3, Group, MathUtils, Mesh, Vector2, Vector3 } from 'three'
import { foldDirectionSign, resolveFoldBehavior, type ResolvedFoldBehavior } from '../ops/fold-line-ops'
import type { FoldLine } from '../cad/cad-types'
import { distanceToFoldAxisInWorld } from './bridge/geometry-utils'

const EPSILON = 1e-6
const COLLISION_SEARCH_STEP_DEG = 1
const COLLISION_CHECK_CUTOFF_DEG = 90
const MIN_OVERLAP_AREA_WORLD = 0.00002
const MIN_OVERLAP_HEIGHT_WORLD = 0.00045

export function foldAxisFromLine(lineStart: Vector2, lineEnd: Vector2) {
  const axis = new Vector3(lineEnd.x - lineStart.x, 0, lineEnd.y - lineStart.y)
  if (axis.lengthSq() <= EPSILON) {
    return new Vector3(0, 0, 1)
  }
  return axis.normalize()
}

type ResolveSafeFoldAngleParams = {
  targetAngleDeg: number
  behavior: ResolvedFoldBehavior
  applyTransform: (angleDeg: number) => void
  hasCollision: () => boolean
  collisionSearchStepDeg?: number
  collisionCheckCutoffDeg?: number
}

export function resolveSafeFoldAngle({
  targetAngleDeg,
  behavior,
  applyTransform,
  hasCollision,
  collisionSearchStepDeg = COLLISION_SEARCH_STEP_DEG,
  collisionCheckCutoffDeg = COLLISION_CHECK_CUTOFF_DEG,
}: ResolveSafeFoldAngleParams) {
  const clampedTarget = MathUtils.clamp(targetAngleDeg, -behavior.maxAngleDeg, behavior.maxAngleDeg)
  if (Math.abs(clampedTarget) <= EPSILON) {
    applyTransform(clampedTarget)
    return clampedTarget
  }

  const direction = clampedTarget >= 0 ? 1 : -1
  const targetMagnitude = Math.abs(clampedTarget)
  const guardedMagnitude = Math.min(targetMagnitude, collisionCheckCutoffDeg)

  for (let candidateMagnitude = guardedMagnitude; candidateMagnitude >= 0; candidateMagnitude -= collisionSearchStepDeg) {
    const candidate = direction * candidateMagnitude
    applyTransform(candidate)
    if (!hasCollision()) {
      if (targetMagnitude > collisionCheckCutoffDeg && candidateMagnitude >= guardedMagnitude - EPSILON) {
        applyTransform(clampedTarget)
        return clampedTarget
      }
      return candidate
    }
  }

  applyTransform(0)
  return 0
}

type ConfigureFoldParams = {
  foldLine: FoldLine | null
  foldStart: Vector2
  foldEnd: Vector2
  foldingPivot: Group
  transformScale: number
}

type UpdateFoldRotationParams = {
  staticSideGroup: Group
  foldingSideGroup: Group
  modelRoot: Group
}

export class ThreeFoldManager {
  private activeFoldAxis = new Vector3(0, 0, 1)
  private activeFoldMid = new Vector2(0, 0)
  private activeFoldBehavior: ResolvedFoldBehavior = resolveFoldBehavior(null)
  private activeFoldAngleDeg = 0
  private staticPanels: Mesh[] = []
  private foldingPanels: Mesh[] = []
  private staticPanelBoxes: Box3[] = []
  private transformScale = 1

  get behavior() {
    return this.activeFoldBehavior
  }

  get angleDeg() {
    return this.activeFoldAngleDeg
  }

  get axis() {
    return this.activeFoldAxis.clone()
  }

  get mid() {
    return this.activeFoldMid.clone()
  }

  syncFoldLine(foldLine: FoldLine | null) {
    this.activeFoldBehavior = resolveFoldBehavior(foldLine)
    this.activeFoldAngleDeg = this.activeFoldBehavior.targetAngleDeg
  }

  configureFold({ foldLine, foldStart, foldEnd, foldingPivot, transformScale }: ConfigureFoldParams) {
    this.transformScale = transformScale
    this.activeFoldMid = foldStart.clone().add(foldEnd).multiplyScalar(0.5)
    this.activeFoldAxis = foldAxisFromLine(foldStart, foldEnd)
    this.activeFoldBehavior = resolveFoldBehavior(foldLine)
    this.activeFoldAngleDeg = MathUtils.clamp(
      this.activeFoldAngleDeg,
      -this.activeFoldBehavior.maxAngleDeg,
      this.activeFoldBehavior.maxAngleDeg,
    )
    foldingPivot.position.set(this.activeFoldMid.x, 0, this.activeFoldMid.y)
    return this.activeFoldBehavior
  }

  resetPanels() {
    this.staticPanels = []
    this.foldingPanels = []
    this.staticPanelBoxes = []
  }

  registerStaticPanel(panel: Mesh) {
    this.staticPanels.push(panel)
  }

  registerFoldingPanel(panel: Mesh) {
    this.foldingPanels.push(panel)
  }

  setAngle(angleDeg: number) {
    this.activeFoldAngleDeg = MathUtils.clamp(angleDeg, -this.activeFoldBehavior.maxAngleDeg, this.activeFoldBehavior.maxAngleDeg)
    return this.activeFoldAngleDeg
  }

  private foldLiftWorldForAngle(angleDeg: number, behavior: ResolvedFoldBehavior) {
    const signedAngleDeg = foldDirectionSign(behavior.direction) * angleDeg
    if (Math.abs(signedAngleDeg) <= EPSILON) {
      return 0
    }

    const radians = MathUtils.degToRad(Math.abs(signedAngleDeg))
    const thicknessWorld = behavior.thicknessMm * this.transformScale
    const clearanceWorld = behavior.clearanceMm * this.transformScale
    const radiusWorld = behavior.radiusMm * this.transformScale
    const neutralAxisAdjustment = (behavior.neutralAxisRatio - 0.5) * thicknessWorld * Math.sin(radians)
    const hingeLift = (thicknessWorld + clearanceWorld) * Math.sin(radians / 2)
    const curvatureLift = radiusWorld * (1 - Math.cos(radians))
    return (hingeLift + curvatureLift + neutralAxisAdjustment) * Math.sign(signedAngleDeg)
  }

  private applyFoldTransform(
    angleDeg: number,
    behavior: ResolvedFoldBehavior,
    foldingSideGroup: Group,
    modelRoot: Group,
  ) {
    const signedRadians = foldDirectionSign(behavior.direction) * MathUtils.degToRad(angleDeg)
    foldingSideGroup.quaternion.setFromAxisAngle(this.activeFoldAxis, signedRadians)
    foldingSideGroup.position.set(0, this.foldLiftWorldForAngle(angleDeg, behavior), 0)
    modelRoot.updateMatrixWorld(true)
  }

  private rebuildStaticPanelBoxCache(staticSideGroup: Group) {
    staticSideGroup.updateMatrixWorld(true)
    this.staticPanelBoxes = this.staticPanels.map((panel) => new Box3().setFromObject(panel))
  }

  private hasPanelCollision(behavior: ResolvedFoldBehavior) {
    if (this.staticPanelBoxes.length === 0 || this.foldingPanels.length === 0) {
      return false
    }

    const clearanceWorld = behavior.clearanceMm * this.transformScale
    const thicknessWorld = behavior.thicknessMm * this.transformScale
    const hingeAllowance = (behavior.radiusMm + behavior.clearanceMm + behavior.thicknessMm * 0.5) * this.transformScale
    const overlapHeightThreshold = Math.max(MIN_OVERLAP_HEIGHT_WORLD, clearanceWorld * (0.35 + behavior.stiffness * 0.65))
    const overlapAreaThreshold = Math.max(
      MIN_OVERLAP_AREA_WORLD,
      Math.max(clearanceWorld, thicknessWorld * 0.4) * Math.max(clearanceWorld, thicknessWorld * 0.4),
    )
    const foldingBox = new Box3()
    const overlapBox = new Box3()
    const overlapSize = new Vector3()
    const overlapCenter = new Vector3()

    for (const foldingPanel of this.foldingPanels) {
      foldingBox.setFromObject(foldingPanel)
      for (const staticBox of this.staticPanelBoxes) {
        if (!foldingBox.intersectsBox(staticBox)) {
          continue
        }

        overlapBox.copy(foldingBox).intersect(staticBox)
        if (overlapBox.isEmpty()) {
          continue
        }

        overlapBox.getSize(overlapSize)
        const overlapArea = overlapSize.x * overlapSize.z
        if (overlapArea <= overlapAreaThreshold || overlapSize.y <= overlapHeightThreshold) {
          continue
        }

        overlapBox.getCenter(overlapCenter)
        const axisDistance = distanceToFoldAxisInWorld(overlapCenter, this.activeFoldMid, this.activeFoldAxis)
        if (axisDistance > hingeAllowance) {
          return true
        }
      }
    }

    return false
  }

  updateRotation({ staticSideGroup, foldingSideGroup, modelRoot }: UpdateFoldRotationParams) {
    this.rebuildStaticPanelBoxCache(staticSideGroup)
    return resolveSafeFoldAngle({
      targetAngleDeg: this.activeFoldAngleDeg,
      behavior: this.activeFoldBehavior,
      applyTransform: (candidateAngleDeg) => {
        this.applyFoldTransform(candidateAngleDeg, this.activeFoldBehavior, foldingSideGroup, modelRoot)
      },
      hasCollision: () => this.hasPanelCollision(this.activeFoldBehavior),
    })
  }
}
