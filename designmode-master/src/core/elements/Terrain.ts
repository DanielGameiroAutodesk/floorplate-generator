import { assertIsDefined } from "src/lib/assertions"
import { extractTerrainGeometryData, loadTerrainBackgroundCache } from "src/core/terrain/terrain-cache"
import type { TerrainElement, TerrainTextureProps } from "src/core/terrain/terrain-types"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import type { Mesh } from "three"
import { getOrCompute } from "./internal/get-or-compute"
import type { ChildNodeContainer } from "./ChildNodeContainer"
import type { TerrainData } from "./terrain-data"
import { getTerrainCustomData } from "./terrain-data"
import type { Urn } from "forma-elements"
import { ElementKeyPath } from "src/lib/element/path"
import type { DisposableStore } from "./derived-data/derived-data"

const terrainCache = new WeakMap<ChildNodeContainer, Terrain>()

export type TerrainBBox = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

/**
 * This represents the concept terrain in a proposal.
 */
export class Terrain {
  readonly derivedDataDisposables: DisposableStore

  private constructor(public readonly node: ChildNodeContainer) {
    // Ensure TerrainData is loaded.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.data

    this.derivedDataDisposables = node.derivedDataDisposables
  }

  static of(node: ChildNodeContainer) {
    return getOrCompute(terrainCache, node, () => new Terrain(node))
  }

  get key(): string {
    return this.node.child.key
  }

  get urn(): Urn {
    return this.node.elementContainer.element.urn
  }

  get path(): ElementKeyPath {
    return ElementKeyPath.of(this.node.path)
  }

  get container() {
    return this.node.elementContainer
  }

  get data(): TerrainData {
    return assertIsDefined("Terrain should be loaded", getTerrainCustomData(this.node.elementContainer))
  }

  get mesh(): Mesh {
    return this.data.mesh
  }

  get texture(): TerrainTextureProps | undefined {
    return this.data.mapTerrainTexture
  }

  get element(): TerrainElement {
    const result = this.node.elementContainer.element
    if (!isTerrainElement(result)) {
      throw new Error("Invalid terrain element")
    }
    return result
  }

  getTerrainBackgroundTexture() {
    return loadTerrainBackgroundCache(this.urn)
  }

  getTerrainGeometryData() {
    return extractTerrainGeometryData(this.data.mesh.geometry)
  }

  get textureAttributionTag() {
    return this.texture?.attributionTag
  }
}
