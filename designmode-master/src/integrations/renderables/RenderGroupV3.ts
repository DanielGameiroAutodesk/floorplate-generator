import { Group } from "three"
import type { Renderable3DInstance, RenderingMode, RenderingSpec } from "./renderable"
import { RenderingSpecs } from "./renderable"
import { assignGeometriesToGroups } from "./allocateGeometriesToGroups"
import { Set_shallowEquals } from "src/lib/set"
import type { GeometryUuid, UniqueGeometry } from "./BatchedMeshForRenderables"
import { BatchedMeshForRenderables, geometryUuidForBufferGeometry } from "./BatchedMeshForRenderables"
import { isDebugEnabled } from "src/lib/debug"
import { WorkaroundForBrokenBatchedMesh } from "./WorkaroundForBrokenBatchedMesh"

function validateRenderableInstanceOrThrow(
  renderable: Renderable3DInstance,
  groupRenderingSpec: RenderingSpec,
  groupRenderingMode: RenderingMode,
) {
  if (
    renderable.renderingSpec !== groupRenderingSpec ||
    (renderable.renderingMode ?? "normal") !== groupRenderingMode
  ) {
    throw new Error(`RenderGroupV3: RenderableInstance has different spec/mode than group`)
  }
  const spec = RenderingSpecs[renderable.renderingSpec]
  spec.buffers.forEach((buffer) => {
    if (!renderable.geometry.hasAttribute(buffer.name)) {
      throw new Error(`RenderGroupV3: Buffer ${buffer.name} missing from renderable ${renderable.geometry.name}`)
    }
    const attribute = renderable.geometry.getAttribute(buffer.name)
    const validSize = attribute.itemSize === buffer.size
    const validType = attribute.array instanceof buffer.type
    const validNormalized = !!buffer.normalized === attribute.normalized
    if (!validSize || !validType || !validNormalized) {
      throw new Error(
        `RenderGroupV3: Invalid buffer ${buffer.name} on renderable ${renderable.geometry.name} ` +
          `(validSize=${validSize} validType=${validType} validNormalized=${validNormalized})`,
      )
    }
  })
  // TODO: It seems most BufferGeometries in DesignMode have an index specified, so we default to
  // requiring an index to be on the safe side. However, it turns out that outlines don't produce an
  // index and never need it, so we won't enforce an index for renderables of the LineSegments mode.
  // This should eventually be cleaned up to be more consistent across DesignMode
  const hasIndex = !!renderable.geometry.getIndex()
  if (spec.shouldHaveIndex !== hasIndex) {
    throw new Error(
      `RenderGroupV3: Inconsistent index on renderable ${renderable.geometry.name} ` +
        `(shouldHaveIndex=${spec.shouldHaveIndex} hasIndex=${hasIndex})`,
    )
  }
}

function constructBatchedMesh(name: string, renderingSpec: RenderingSpec, renderingMode: RenderingMode) {
  const shouldUseWorkaroundForBrokenBatchedMesh = isChrome139OnMacOS()
  if (shouldUseWorkaroundForBrokenBatchedMesh) {
    return new WorkaroundForBrokenBatchedMesh(name, renderingSpec, renderingMode)
  }
  return new BatchedMeshForRenderables(name, renderingSpec, renderingMode)
}

if (isChrome139OnMacOS()) {
  console.log("Using workaround for broken BatchedMesh in Chrome 139 on Mac")
} else {
  console.log("Using regular BatchedMesh")
}

function isChrome139OnMacOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isMac = /Mac OS X/.test(ua)
  const isChrome139 =
    /(Chrome|HeadlessChrome)\/139\./.test(ua) &&
    !/Edg\//.test(ua) &&
    !/OPR\//.test(ua) &&
    !/Chromium\//.test(ua) &&
    !/CriOS\//.test(ua)
  return isMac && isChrome139
}

/**
 * Handles rendering for a number of renderable instances of the same rendering spec/mode, i.e.
 * with the same final material to use for rendering. To minimize the number of render calls to
 * WebGL, renderables are merged into larger groups before rendering.
 *
 * We don't want everything to merge into one huge group, as this would lead to costly rebuilding of
 * the merged geometry on every proposal change. RenderGroupV3 instead creates a number of smaller
 * groups that coalesce into larger groups for infrequently changed renderables, trying to strike a
 * balance between minimizing render calls and making geometry updates cheap. The algorithm for
 * clustering into larger groups is kept separate in allocateGeometriesToGroups.ts.
 *
 * RenderableV3Instances that share the same geometry (i.e. point to the same BufferGeometry but
 * with different transforms) are treated together as one unit by this part of the pipeline. This is
 * because we only incorporate one copy of each unique BufferGeometry in the merged geometry, and
 * afterwards use instancing in BatchedMesh to render multiple copies with separate transforms.
 */
export class RenderGroupV3 extends Group {
  readonly renderingSpec: RenderingSpec
  readonly renderingMode: RenderingMode

  private currentGeometryGroups: GeometryUuid[][]
  private currentBatchedMeshes: Map<number, BatchedMeshForRenderables | WorkaroundForBrokenBatchedMesh>

  constructor(renderingSpec: RenderingSpec, renderingMode: RenderingMode) {
    super()
    this.name = `RenderGroupV3 - ${renderingSpec} - ${renderingMode}`
    this.renderingSpec = renderingSpec
    this.renderingMode = renderingMode
    this.currentGeometryGroups = []
    this.currentBatchedMeshes = new Map()
  }

  update(instances: Renderable3DInstance[]) {
    if (isDebugEnabled) {
      performance.mark("RenderGroupV3 start")
    }

    // First, cluster all renderable instances by unique geometry, for instancing in the BatchedMesh
    // later. Geometry uniqueness is determined by looking at the BufferGeometry.uuid field
    const uniqueGeometries: Map<GeometryUuid, UniqueGeometry> = new Map()
    instances.forEach((instance) => {
      validateRenderableInstanceOrThrow(instance, this.renderingSpec, this.renderingMode)
      const uniqueGeometryUuid = geometryUuidForBufferGeometry(instance.geometry)
      if (!uniqueGeometries.has(uniqueGeometryUuid)) {
        uniqueGeometries.set(uniqueGeometryUuid, {
          geometry: instance.geometry,
          instances: new Set(),
        })
      }
      const uniqueGeometry = uniqueGeometries.get(uniqueGeometryUuid)!
      if (uniqueGeometry.geometry !== instance.geometry) {
        throw new Error("Same UUID used by different BufferGeometry objects")
      }
      uniqueGeometry.instances.add(instance)
    })

    // Call out to the grouping algorithm to determine which geometries to merge together
    const newGeometryGroups: GeometryUuid[][] = assignGeometriesToGroups(
      [...uniqueGeometries.keys()],
      (uniqueGeometryUuid) => uniqueGeometries.get(uniqueGeometryUuid)!.geometry.attributes.position.count,
      this.currentGeometryGroups,
    )

    const oldGeometryGroupIds: Set<number> = new Set(this.currentGeometryGroups.keys())
    const newGeometryGroupIds: Set<number> = new Set(newGeometryGroups.keys())

    const removeGroupIds = [...oldGeometryGroupIds].filter((id) => !newGeometryGroupIds.has(id))
    const createGroupIds = [...newGeometryGroupIds].filter((id) => !oldGeometryGroupIds.has(id))

    // If the grouping algorithm comes back with a group ID that was also used previously, we need
    // to check whether the group composition is unchanged. If any of the included geometries have
    // changed, we simply destroy the old BatchedMesh and create a new one from scratch. (Note that
    // this only cares about the composition of unique geometries, as individual _instances_ of a
    // geometry may be added and removed without affecting this step of the process)
    const overlappingGroupIds = [...oldGeometryGroupIds].filter((id) => newGeometryGroupIds.has(id))
    overlappingGroupIds.forEach((overlappingGroupId) => {
      const geometryUuidsInOldGroup = new Set(this.currentGeometryGroups[overlappingGroupId])
      const geometryUuidsInNewGroup = new Set(newGeometryGroups[overlappingGroupId])
      const groupsIdenticalBeforeAndAfter = Set_shallowEquals(geometryUuidsInOldGroup, geometryUuidsInNewGroup)
      if (!groupsIdenticalBeforeAndAfter) {
        removeGroupIds.push(overlappingGroupId)
        createGroupIds.push(overlappingGroupId)
      }
    })

    // Destroy all the obsolete BatchedMeshes
    removeGroupIds.forEach((removeGroupId) => {
      const batchedMesh = this.currentBatchedMeshes.get(removeGroupId)!
      this.currentBatchedMeshes.delete(removeGroupId)
      this.remove(batchedMesh)
      batchedMesh.dispose()
    })

    // Create the new BatchedMeshes (to be populated in the next step below)
    createGroupIds.forEach((createGroupId) => {
      const name = `${this.name} - group ${createGroupId}`
      const batchedMesh = constructBatchedMesh(name, this.renderingSpec, this.renderingMode)
      this.currentBatchedMeshes.set(createGroupId, batchedMesh)
      this.add(batchedMesh)
    })

    // For all BatchedMeshes that are alive after this update (either because they were unchanged, or
    // because they were just created above), we now "refresh" the contents of the BatchedMesh. This
    // calls out to our BatchedMeshForRenderables wrapper class, that is responsible for updating
    // and bookkeeping which geometries/instances are already added to the BatchedMesh
    newGeometryGroupIds.forEach((refreshGroupId) => {
      const uniqueGeometriesForGroup = new Map(
        newGeometryGroups[refreshGroupId].map((uniqueGeometryUuid) => [
          uniqueGeometryUuid,
          uniqueGeometries.get(uniqueGeometryUuid)!,
        ]),
      )
      const batchedMesh = this.currentBatchedMeshes.get(refreshGroupId)!
      batchedMesh.update(uniqueGeometriesForGroup)
    })

    this.currentGeometryGroups = newGeometryGroups

    if (isDebugEnabled && createGroupIds.length > 0) {
      performance.mark("RenderGroupV3 finish")
      const measure = performance.measure("RenderGroupV3 update", "RenderGroupV3 start", "RenderGroupV3 finish")
      let output = `${this.name} (${measure.duration.toFixed(1)} ms):`
      const groupIds = [...this.currentBatchedMeshes.keys()].sort((a, b) => a - b)
      groupIds.forEach((groupId) => {
        const batchedMesh = this.currentBatchedMeshes.get(groupId)!
        const vertexCount = batchedMesh.vertexCount
        const updatedNow = createGroupIds.includes(groupId)
        output += ` ${vertexCount}${updatedNow ? "*" : ""}`
      })
      console.log(output)
    }
  }
}
