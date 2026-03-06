import type { Texture } from "three"
import { TextureLoader, SRGBColorSpace } from "three"
import sceneManager from "src/core/three/sceneManager"

const loader = new TextureLoader()
const textureCache: Record<string, Texture> = {}

export const loadTexture = (referenceImgUrl: string) => {
  const cachedTexture = textureCache[referenceImgUrl]
  if (cachedTexture) return cachedTexture

  const texture = loader.load(referenceImgUrl, (texture) => {
    texture.name = referenceImgUrl
    texture.colorSpace = SRGBColorSpace
    sceneManager.render(false, true)
    return texture
  })

  textureCache[referenceImgUrl] = texture
  return texture
}
