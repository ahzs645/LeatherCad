import { BufferGeometry, Material, type Group, type Mesh, type Object3D } from 'three'

export function disposeObjectGraph(root: Object3D, preservedMaterials: Set<Material>) {
  root.traverse((object) => {
    const meshLike = object as Mesh
    if ('geometry' in meshLike && meshLike.geometry instanceof BufferGeometry) {
      meshLike.geometry.dispose()
    }

    if ('material' in meshLike) {
      const material = meshLike.material
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (!preservedMaterials.has(entry)) {
            entry.dispose()
          }
        }
      } else if (material instanceof Material && !preservedMaterials.has(material)) {
        material.dispose()
      }
    }
  })
}

export function clearGroup(group: Group, preservedMaterials: Set<Material>) {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)
    disposeObjectGraph(child, preservedMaterials)
  }
}
