export type XpbdParticleState = {
  positions: Float32Array
  previousPositions: Float32Array
  velocities: Float32Array
  inverseMasses: Float32Array
}

export type XpbdDistanceConstraint = {
  kind: 'distance'
  a: number
  b: number
  restLength: number
  compliance: number
  lambda: number
}

export type XpbdConstraint = XpbdDistanceConstraint

export type XpbdStepOptions = {
  dt: number
  substeps: number
  iterations: number
  damping: number
  gravityY?: number
}

function particleOffset(index: number) {
  return index * 3
}

function solveDistanceConstraint(state: XpbdParticleState, constraint: XpbdDistanceConstraint, dt: number) {
  const aOffset = particleOffset(constraint.a)
  const bOffset = particleOffset(constraint.b)
  const ax = state.positions[aOffset]
  const ay = state.positions[aOffset + 1]
  const az = state.positions[aOffset + 2]
  const bx = state.positions[bOffset]
  const by = state.positions[bOffset + 1]
  const bz = state.positions[bOffset + 2]
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  const length = Math.hypot(dx, dy, dz)
  if (length <= 1e-9) {
    return
  }

  const invMassA = state.inverseMasses[constraint.a]
  const invMassB = state.inverseMasses[constraint.b]
  const invMassSum = invMassA + invMassB
  if (invMassSum <= 1e-9) {
    return
  }

  const alphaTilde = constraint.compliance / (dt * dt)
  const constraintValue = length - constraint.restLength
  const deltaLambda = -(constraintValue + alphaTilde * constraint.lambda) / (invMassSum + alphaTilde)
  constraint.lambda += deltaLambda

  const nx = dx / length
  const ny = dy / length
  const nz = dz / length
  state.positions[aOffset] += invMassA * deltaLambda * nx
  state.positions[aOffset + 1] += invMassA * deltaLambda * ny
  state.positions[aOffset + 2] += invMassA * deltaLambda * nz
  state.positions[bOffset] -= invMassB * deltaLambda * nx
  state.positions[bOffset + 1] -= invMassB * deltaLambda * ny
  state.positions[bOffset + 2] -= invMassB * deltaLambda * nz
}

function solveConstraint(state: XpbdParticleState, constraint: XpbdConstraint, dt: number) {
  switch (constraint.kind) {
    case 'distance':
      solveDistanceConstraint(state, constraint, dt)
      break
  }
}

export function createDistanceConstraint(params: {
  a: number
  b: number
  restLength: number
  compliance?: number
}): XpbdDistanceConstraint {
  return {
    kind: 'distance',
    a: params.a,
    b: params.b,
    restLength: params.restLength,
    compliance: params.compliance ?? 1e-7,
    lambda: 0,
  }
}

export function stepXpbdLite(
  state: XpbdParticleState,
  constraints: XpbdConstraint[],
  options: XpbdStepOptions,
) {
  const particleCount = state.inverseMasses.length
  const substeps = Math.max(1, Math.round(options.substeps))
  const iterations = Math.max(1, Math.round(options.iterations))
  const dt = options.dt / substeps
  const gravityY = options.gravityY ?? 0
  const damping = Math.max(0, Math.min(1, options.damping))

  for (let substep = 0; substep < substeps; substep += 1) {
    for (let index = 0; index < particleCount; index += 1) {
      if (state.inverseMasses[index] <= 0) {
        continue
      }
      const offset = particleOffset(index)
      state.velocities[offset + 1] += gravityY * dt
      state.velocities[offset] *= damping
      state.velocities[offset + 1] *= damping
      state.velocities[offset + 2] *= damping
      state.previousPositions[offset] = state.positions[offset]
      state.previousPositions[offset + 1] = state.positions[offset + 1]
      state.previousPositions[offset + 2] = state.positions[offset + 2]
      state.positions[offset] += state.velocities[offset] * dt
      state.positions[offset + 1] += state.velocities[offset + 1] * dt
      state.positions[offset + 2] += state.velocities[offset + 2] * dt
    }

    for (const constraint of constraints) {
      constraint.lambda = 0
    }
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (const constraint of constraints) {
        solveConstraint(state, constraint, dt)
      }
    }

    for (let index = 0; index < particleCount; index += 1) {
      if (state.inverseMasses[index] <= 0) {
        continue
      }
      const offset = particleOffset(index)
      state.velocities[offset] = (state.positions[offset] - state.previousPositions[offset]) / dt
      state.velocities[offset + 1] = (state.positions[offset + 1] - state.previousPositions[offset + 1]) / dt
      state.velocities[offset + 2] = (state.positions[offset + 2] - state.previousPositions[offset + 2]) / dt
    }
  }
}
