declare module 'clipper-lib' {
  namespace ClipperLib {
    interface IntPoint {
      X: number
      Y: number
    }

    const ClipType: {
      ctIntersection: number
      ctUnion: number
      ctDifference: number
      ctXor: number
    }

    const PolyType: {
      ptSubject: number
      ptClip: number
    }

    const PolyFillType: {
      pftEvenOdd: number
      pftNonZero: number
      pftPositive: number
      pftNegative: number
    }

    const JoinType: {
      jtSquare: number
      jtRound: number
      jtMiter: number
    }

    const EndType: {
      etClosedPolygon: number
      etClosedLine: number
      etOpenButt: number
      etOpenSquare: number
      etOpenRound: number
    }

    class Clipper {
      AddPath(path: IntPoint[], polyType: number, closed: boolean): void
      AddPaths(paths: IntPoint[][], polyType: number, closed: boolean): void
      Execute(
        clipType: number,
        solution: IntPoint[][],
        subjFillType?: number,
        clipFillType?: number,
      ): boolean
    }

    class ClipperOffset {
      constructor(miterLimit?: number, arcTolerance?: number)
      AddPath(path: IntPoint[], joinType: number, endType: number): void
      AddPaths(paths: IntPoint[][], joinType: number, endType: number): void
      Execute(solution: IntPoint[][], delta: number): void
    }
  }

  export = ClipperLib
}
