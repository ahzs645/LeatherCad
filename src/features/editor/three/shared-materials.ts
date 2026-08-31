/**
 * Materials that outlive a rebuild.
 *
 * three.js compiles one shader program per material *configuration* and
 * refcounts it by the materials using it. A material built fresh inside a
 * rebuild is disposed with the group it went into, and if it was the last one
 * of its configuration it takes the compiled program with it — so the next
 * rebuild links the same program again from source.
 *
 * That is invisible until something rebuilds per input event. Dragging a fold
 * angle on the wallet did: four programs deleted and relinked, eight shaders
 * compiled, every event. Once the fold solve moved off the main thread, this
 * was the largest thing left on it.
 *
 * The fix is only to keep an instance of each configuration alive, and the
 * configuration is what the program is keyed on — not the colour, which is a
 * uniform. Materials are therefore cached by their full parameters, including
 * colour, and the cache is bounded: a seam tinted by a stress score walks
 * through a new colour every frame, and without a bound that walk would be a
 * leak. Anything still in the cache is disposed with the bridge.
 */

import {
  Color,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  MeshStandardMaterial,
  type ColorRepresentation,
} from 'three'

/**
 * How many materials stay live. Comfortably more than a rebuild uses at once
 * — eviction disposes, and disposing something the current frame still draws
 * with would cost the recompile this exists to avoid.
 */
const MAX_SHARED_MATERIALS = 64

function hexOf(color: ColorRepresentation) {
  return (color instanceof Color ? color : new Color(color)).getHexString()
}

export class SharedMaterials {
  private readonly preserved: Set<Material>
  /** Insertion-ordered, so the front of the map is the least recently used. */
  private readonly cache = new Map<string, Material>()

  constructor(preserved: Set<Material>) {
    this.preserved = preserved
  }

  private reuse<TMaterial extends Material>(key: string, create: () => TMaterial): TMaterial {
    const existing = this.cache.get(key)
    if (existing) {
      this.cache.delete(key)
      this.cache.set(key, existing)
      return existing as TMaterial
    }
    const material = create()
    this.cache.set(key, material)
    this.preserved.add(material)
    while (this.cache.size > MAX_SHARED_MATERIALS) {
      const oldest = this.cache.keys().next()
      if (oldest.done) break
      const evicted = this.cache.get(oldest.value)
      this.cache.delete(oldest.value)
      if (evicted) {
        this.preserved.delete(evicted)
        evicted.dispose()
      }
    }
    return material
  }

  /** Piece and region outlines. */
  outline(color: ColorRepresentation) {
    return this.reuse(`outline:${hexOf(color)}`, () => new LineBasicMaterial({ color }))
  }

  /** The guide drawn between the two sides of a seam. */
  seamGuide(color: ColorRepresentation, dashed: boolean) {
    const hex = hexOf(color)
    return dashed
      ? this.reuse(
          `seam-guide-dashed:${hex}`,
          () => new LineDashedMaterial({ color, dashSize: 0.04, gapSize: 0.025 }),
        )
      : this.reuse(`seam-guide:${hex}`, () => new LineBasicMaterial({ color }))
  }

  /** The thread drawn across a seam that has not closed. */
  seamStitch(color: ColorRepresentation) {
    return this.reuse(
      `seam-stitch:${hexOf(color)}`,
      () => new LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    )
  }

  /** Stitch holes and the thread running through them. */
  stitchThread(color: ColorRepresentation) {
    return this.reuse(
      `stitch-thread:${hexOf(color)}`,
      () => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }),
    )
  }

  /** A cut edge painted a colour of its own. */
  edgePaint(color: ColorRepresentation) {
    return this.reuse(
      `edge-paint:${hexOf(color)}`,
      () => new MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.02 }),
    )
  }

  /**
   * A surface material that takes its tint from the geometry's own colours.
   *
   * Vertex colours are part of a shader's configuration, not a uniform, so a
   * tinted surface is a different program from an untinted one — which is
   * exactly why it cannot be had by flipping the flag on a material every
   * other piece is drawn with. The copy is keyed on the source it was taken
   * from and re-synced from it on each use, so the leather's colour and
   * texture stay the source's to change while the program stays this cache's
   * to keep.
   */
  vertexTinted(source: Material) {
    const material = this.reuse(`vertex-tinted:${source.uuid}`, () => source.clone())
    material.copy(source)
    material.vertexColors = true
    return material
  }

  /** A cut edge burnished: the leather's own colour, compressed and darkened. */
  burnishedEdge(color: ColorRepresentation) {
    return this.reuse(
      `edge-burnished:${hexOf(color)}`,
      () => new MeshStandardMaterial({ color, roughness: 0.24, metalness: 0.04 }),
    )
  }

  dispose() {
    for (const material of this.cache.values()) {
      this.preserved.delete(material)
      material.dispose()
    }
    this.cache.clear()
  }
}

/** A cache with no bridge behind it, for tests and one-shot renders. */
export function createSharedMaterials(preserved: Set<Material> = new Set()) {
  return new SharedMaterials(preserved)
}
