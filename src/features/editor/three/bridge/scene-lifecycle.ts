import * as THREE from 'three'

export function disposeObjectGraph(root: THREE.Object3D, preservedMaterials: Set<THREE.Material>) {
  root.traverse((object) => {
    const meshLike = object as THREE.Mesh
    if ('geometry' in meshLike && meshLike.geometry instanceof THREE.BufferGeometry) {
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
      } else if (material instanceof THREE.Material && !preservedMaterials.has(material)) {
        material.dispose()
      }
    }
  })
}

export function clearGroup(group: THREE.Group, preservedMaterials: Set<THREE.Material>) {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)
    disposeObjectGraph(child, preservedMaterials)
  }
}
