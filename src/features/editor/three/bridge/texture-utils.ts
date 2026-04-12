import type { Texture, TextureLoader } from 'three'

export function loadTexture(loader: TextureLoader, url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture: Texture) => resolve(texture),
      undefined,
      (error: unknown) => reject(error instanceof Error ? error : new Error('Texture load failed')),
    )
  })
}
