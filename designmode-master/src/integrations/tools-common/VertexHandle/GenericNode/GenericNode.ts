import type { Vector3 } from "three"
import { AlwaysDepth, Group, Sprite, SpriteMaterial, TextureLoader } from "three"
import snapActiveTexture from "./textures/snap_active.png"
import snapPassiveTexture from "./textures/snap_passive.png"
import selectedTexture from "./textures/snap_passive.png"
import normalTexture from "./textures/normal.png"
import hoveredTexture from "./textures/hovered.png"

const spriteMaterialProps = {
  color: 0xffffff,
  depthFunc: AlwaysDepth,
  transparent: true,
  sizeAttenuation: false,
  userData: { preventClipping: true },
}
const loader = new TextureLoader()

function load(url: string, name: string) {
  return loader.load(url, (texture) => {
    texture.name = name
    return texture
  })
}

const normalMaterial = new SpriteMaterial({
  ...spriteMaterialProps,
  map: load(normalTexture, "GenericNode Normal"),
})

const hoveredMaterial = new SpriteMaterial({
  ...spriteMaterialProps,
  map: load(hoveredTexture, "GenericNode Hovered"),
})

const snapActiveMaterial = new SpriteMaterial({
  ...spriteMaterialProps,
  map: load(snapActiveTexture, "GenericNode Snap Active"),
})

const snapPassiveMaterial = new SpriteMaterial({
  ...spriteMaterialProps,
  map: load(snapPassiveTexture, "GenericNode Snap Passive"),
})

const selectedMaterial = new SpriteMaterial({
  ...spriteMaterialProps,
  map: load(selectedTexture, "GenericNode Selected"),
})

export class GenericNode extends Group {
  private readonly sprite: Sprite

  public constructor(position: Vector3) {
    super()
    this.sprite = new Sprite(normalMaterial)
    this.sprite.scale.set(1.5, 1.5, 1)
    this.add(this.sprite)
    this.renderOrder = 1

    this.position.copy(position)
    this.add(this.sprite)
  }

  public dispose(): void {
    this.parent && this.parent.remove(this)
    this.sprite.geometry.dispose()
  }

  public update(position: Vector3): void {
    this.position.copy(position)
  }

  public hover(): void {
    this.sprite.material = hoveredMaterial
  }

  public snapActive(): void {
    this.renderOrder = 2 // Give priority over passive points
    this.sprite.material = snapActiveMaterial
  }

  public snapPassive(): void {
    this.renderOrder = 2
    this.sprite.material = snapPassiveMaterial
  }

  public select(): void {
    this.sprite.material = selectedMaterial
  }

  public reset(): void {
    this.sprite.material = normalMaterial
  }
}
