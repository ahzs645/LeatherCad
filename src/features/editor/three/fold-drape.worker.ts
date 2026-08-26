/**
 * The fold drape, solved off the main thread.
 *
 * The solve is a pure function of typed-array-friendly inputs, so the whole of
 * it moves across a `postMessage` unchanged: this module is the engine's
 * steady-solver protocol wired to `solveFoldDrapeData`, and the mesh it
 * returns is transferred rather than copied. What the main thread does with
 * the result — hydrating it into something a renderer can ask questions of —
 * stays there.
 */

import { serveSteadySolverPlugin, type SolveWorkerScope } from '@atelier/sim'
import {
  solveFoldDrapeData,
  type FoldDrapeData,
  type FoldDrapeParams,
} from './assembled-fold-drape'

serveSteadySolverPlugin<null, FoldDrapeParams, FoldDrapeData | null>(
  self as unknown as SolveWorkerScope,
  {
    id: 'leathercad-fold-drape',
    backend: 'cpu',
    prepare: async () => ({
      // Nothing to hold between solves: each query carries its own piece, its
      // own obstacles, and its own warm start.
      solve: async (params) => solveFoldDrapeData(params),
      dispose: () => {},
    }),
  },
  {
    transferResult: (result) =>
      result
        ? [
            result.positions.buffer,
            result.restPositions.buffer,
            result.normals.buffer,
            result.thicknessScale.buffer,
            result.stress.buffer,
            result.clash.buffer,
          ]
        : [],
  },
)
