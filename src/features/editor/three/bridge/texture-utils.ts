import * as THREE from 'three'

export function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture: THREE.Texture) => resolve(texture),
      undefined,
      (error: unknown) => reject(error instanceof Error ? error : new Error('Texture load failed')),
    )
  })
}
