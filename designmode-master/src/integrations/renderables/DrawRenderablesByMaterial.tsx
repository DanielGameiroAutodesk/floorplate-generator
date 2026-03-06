import type { Renderable3DInstance, RenderingMode, RenderingSpec } from "./renderable"
import { RenderGroupV3 } from "./RenderGroupV3"
import { Group } from "three"

type RenderableBucket = `${RenderingSpec} ${RenderingMode}`

function getBucketForRenderable(r: Renderable3DInstance): RenderableBucket {
  return `${r.renderingSpec} ${r.renderingMode ?? "normal"}`
}

function getSpecAndModeForRenderableBucket(key: RenderableBucket): {
  renderingSpec: RenderingSpec
  renderingMode: RenderingMode
} {
  const tokens = key.split(" ")
  const renderingSpec = tokens[0] as RenderingSpec
  const renderingMode = tokens[1] as RenderingMode
  return { renderingSpec, renderingMode }
}

/**
 * Group renderables into "buckets" according to rendering spec/mode (which together determine the
 * material to be used for rendering). Creates a RenderGroupV3 per bucket/material, and keeps them
 * all updated as the lists of provided renderables change. The RenderGroupV3 is responsible for
 * batching the geometries into larger groups and finally rendering them in the three.js scene.
 */
export class DrawRenderablesByMaterial {
  readonly sceneGroup: Group = new Group()
  private renderGroups: Map<RenderableBucket, RenderGroupV3> = new Map()

  update(renderables: Renderable3DInstance[]) {
    const bucketedRenderables: Map<RenderableBucket, Renderable3DInstance[]> = new Map()
    for (let renderable of renderables) {
      const renderableBucket = getBucketForRenderable(renderable)
      if (!bucketedRenderables.has(renderableBucket)) bucketedRenderables.set(renderableBucket, [])
      bucketedRenderables.get(renderableBucket)!.push(renderable)
    }

    const allRenderableBuckets = new Set([...this.renderGroups.keys(), ...bucketedRenderables.keys()])
    allRenderableBuckets.forEach((renderableBucket) => {
      if (!this.renderGroups.has(renderableBucket)) {
        const { renderingSpec, renderingMode } = getSpecAndModeForRenderableBucket(renderableBucket)
        const renderGroup = new RenderGroupV3(renderingSpec, renderingMode)
        this.renderGroups.set(renderableBucket, renderGroup)
        this.sceneGroup.add(renderGroup)
      }
      const renderGroup = this.renderGroups.get(renderableBucket)!
      const renderables = bucketedRenderables.get(renderableBucket) ?? []
      renderGroup.update(renderables)
    })
  }
}
