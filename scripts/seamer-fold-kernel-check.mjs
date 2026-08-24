/**
 * The two defects LeatherCad's fold drape found in seamer-studio's WGSL,
 * reproduced in plain JavaScript so the upstream report is evidence rather
 * than assertion. Run it with `node scripts/seamer-fold-kernel-check.mjs`.
 *
 * Nothing here runs in the app. It is kept beside the write-up in
 * `docs/SEAMER_FOLD_KERNEL_UPSTREAM.md` because a claim about somebody else's
 * shader needs to be checkable by whoever is asked to change it — and because
 * both kernels are the ones this repo's drape depends on, ported.
 */

// Eberly's region walk, parameterised by which difference vector it is fed.
// `seamer` = the WGSL in seamer-studio (v0 = point - p0); `eberly` = the form
// the branch algebra is derived for (v0 = p0 - point).
function closest(p0, p1, p2, point, flavour) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const e0 = sub(p1, p0)
  const e1 = sub(p2, p0)
  const v0 = flavour === 'seamer' ? sub(point, p0) : sub(p0, point)
  const a = dot(e0, e0), b = dot(e0, e1), c = dot(e1, e1)
  const d = dot(e0, v0), e = dot(e1, v0)
  const det = a * c - b * b
  let s = b * e - c * d, t = b * d - a * e
  const cl = (v) => Math.min(1, Math.max(0, v))
  if (s + t < det) {
    if (s < 0) {
      if (t < 0) { if (d < 0) { s = cl(-d / a); t = 0 } else { s = 0; t = cl(-e / c) } }
      else { s = 0; t = cl(-e / c) }
    } else if (t < 0) { s = cl(-d / a); t = 0 }
    else { const inv = 1 / det; s *= inv; t *= inv }
  } else if (s < 0) {
    const t0 = b + d, t1 = c + e
    if (t1 > t0) { s = cl((t1 - t0) / (a - 2 * b + c)); t = 1 - s } else { t = cl(-e / c); s = 0 }
  } else if (t < 0) {
    if (a + d > b + e) { s = cl((c + e - b - d) / (a - 2 * b + c)); t = 1 - s } else { s = cl(-e / c); t = 0 }
  } else { s = cl((c + e - b - d) / (a - 2 * b + c)); t = 1 - s }
  return [p0[0] + s * e0[0] + t * e1[0], p0[1] + s * e0[1] + t * e1[1], p0[2] + s * e0[2] + t * e1[2]]
}

const p0 = [0, 0, 0], p1 = [10, 0, 0], p2 = [0, 0, 10]
// A particle a millimetre above the middle of the face — the case a fold
// landing flat on another panel is made of.
const query = [3.33, 1, 3.33]
const truth = [3.33, 0, 3.33]
const show = (label, point) =>
  `${label.padEnd(8)} -> (${point.map((v) => v.toFixed(2)).join(', ')})  ${
    Math.hypot(point[0] - truth[0], point[1] - truth[1], point[2] - truth[2]) < 1e-6
      ? 'the face point'
      : 'WRONG'
  }`
console.log('closest point to a query over the middle of a triangle:')
console.log(' ', show('eberly', closest(p0, p1, p2, query, 'eberly')))
console.log(' ', show('seamer', closest(p0, p1, p2, query, 'seamer')))

// --- the bending nudge -----------------------------------------------------
// One hinge, two opposite vertices, and one iteration of each sign convention.
const rotate = (p, axis, angle) => {
  const c = Math.cos(angle), s = Math.sin(angle)
  const cross = [axis[1] * p[2] - axis[2] * p[1], axis[2] * p[0] - axis[0] * p[2], axis[0] * p[1] - axis[1] * p[0]]
  const d = axis[0] * p[0] + axis[1] * p[1] + axis[2] * p[2]
  return [p[0] * c + cross[0] * s + axis[0] * d * (1 - c), p[1] * c + cross[1] * s + axis[1] * d * (1 - c), p[2] * c + cross[2] * s + axis[2] * d * (1 - c)]
}
const wrap = (a) => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a)
function dihedral(p1v, p2v, hingeA, hingeB) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const norm = (v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] }
  const edge = norm(sub(hingeB, hingeA))
  const n1 = norm(cross(sub(p1v, hingeA), sub(p1v, hingeB)))
  const n2 = norm(cross(sub(p2v, hingeB), sub(p2v, hingeA)))
  return { phi: wrap(Math.atan2(dot(cross(n1, n2), edge), Math.min(1, Math.max(-1, dot(n1, n2))))), edge }
}
function settle(sign, target) {
  const hingeA = [0, 0, 0], hingeB = [0, 0, 10]
  let a = [-5, 0, 5], b = [5, 0, 5]
  const mid = [0, 0, 5]
  for (let step = 0; step < 20000; step += 1) {
    const { phi, edge } = dihedral(a, b, hingeA, hingeB)
    const error = wrap(phi - target)
    const nudge = Math.min(0.01, Math.max(-0.01, error * 0.01))
    const move = (p, amount) => {
      const rotated = rotate([p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]], edge, amount)
      return [rotated[0] + mid[0], rotated[1] + mid[1], rotated[2] + mid[2]]
    }
    a = move(a, sign * nudge * 0.5)
    b = move(b, -sign * nudge * 0.5)
  }
  return dihedral(a, b, hingeA, hingeB).phi
}
console.log('\nbending nudge, where the hinge comes to rest:')
for (const degrees of [30, 60, 90, 120, 179]) {
  const target = (degrees * Math.PI) / 180
  const fixed = (settle(1, target) * 180) / Math.PI
  const shipped = (settle(-1, target) * 180) / Math.PI
  console.log(
    `  target ${String(degrees).padStart(3)}deg  ->  fixed sign ${fixed.toFixed(1).padStart(7)}deg` +
      `   shipped sign ${shipped.toFixed(1).padStart(7)}deg   (target - 180 = ${(degrees - 180).toString().padStart(4)})`,
  )
}
