import type { BufferGeometry } from "three"
import { BatchedMesh, Group } from "three"
import type { Renderable3DInstance, RenderingMode, RenderingSpec } from "./renderable"
import { RenderingSpecs } from "./renderable"

export type GeometryUuid = `${string}-${string}-${string}-${string}-${string}`
export const geometryUuidForBufferGeometry = (geometry: BufferGeometry): GeometryUuid => geometry.uuid as GeometryUuid
export type UniqueGeometry = {
  geometry: BufferGeometry
  instances: Set<Renderable3DInstance>
}

type BookkeepingPerUniqueGeometry = {
  geometryIdInBatchedMesh: number
  usedInstanceIds: number[]
  unusedInstanceIds: number[]
}

/**
 * Wrapper for BatchedMesh from three.js that also keeps track of which geometries we have already
 * added to the BatchMesh, their corresponding geometryIds in the BatchedMesh, and all of the
 * instanceIds of that geometry we have set up in the BatchedMesh.
 */
export class BatchedMeshForRenderables extends Group {
  private renderingSpec: RenderingSpec
  private renderingMode: RenderingMode

  private batchedMesh: BatchedMesh | undefined
  private instancesUsed = 0
  private bookkeeping: Map<GeometryUuid, BookkeepingPerUniqueGeometry> = new Map()

  constructor(name: string, renderingSpec: RenderingSpec, renderingMode: RenderingMode) {
    super()
    this.name = name
    this.renderingSpec = renderingSpec
    this.renderingMode = renderingMode
  }

  get vertexCount() {
    return this.batchedMesh?.geometry.attributes.position.count ?? 0
  }

  dispose() {
    this._destructBatchedMesh()
  }

  private _destructBatchedMesh() {
    if (!this.batchedMesh) return
    this.remove(this.batchedMesh)
    this.batchedMesh.dispose()
    this.batchedMesh = undefined
    this.instancesUsed = 0
    this.bookkeeping = new Map()
  }

  private _constructBatchedMesh(uniqueGeometries: Map<GeometryUuid, UniqueGeometry>) {
    if (this.batchedMesh) this._destructBatchedMesh()

    let instanceCount = 0
    let vertexCount = 0
    uniqueGeometries.forEach((uniqueGeometry) => {
      instanceCount += uniqueGeometry.instances.size
      vertexCount += uniqueGeometry.geometry.attributes.position.count
    })

    // Create BatchedMesh with material and other parameters according to the rendering spec/mode.
    // Allocate the BatchedMesh with enough instances to fit our current instance count multiplied
    // by 2, to have room to grow. (We don't need room to grow on the vertex count, because we only
    // reuse BatchedMeshes when the set of unique geometries remains the same -- explanation below)
    const INSTANCE_COUNT_MULTIPLIER = 2
    const spec = RenderingSpecs[this.renderingSpec]
    const material = spec.material[this.renderingMode] ?? spec.material["normal"]
    this.batchedMesh = new BatchedMesh(instanceCount * INSTANCE_COUNT_MULTIPLIER, vertexCount, undefined, material)
    this.batchedMesh.receiveShadow = spec.receiveShadow ?? false
    this.batchedMesh.castShadow = spec.castShadow ?? false
    this.batchedMesh.renderOrder = spec.renderOrder ?? 0

    if (spec.drawMode === "LineSegments") {
      this._HACK_mutateBatchedMeshToSupportLines(this.batchedMesh)
    }

    this.add(this.batchedMesh)
  }

  private _HACK_mutateBatchedMeshToSupportLines(batchedMesh: BatchedMesh) {
    // Not pretty -- but it works: BatchedMesh as currently defined in three.js assumes that the
    // geometries added are _meshes_. However, we also need to support geometries that are _lines_
    // (used for edge outlines). The BatchedMesh implementation itself supports lines perfectly
    // fine, as all the logic is correct, but the following three flags need to be overridden to
    // tell WebGLRenderer.renderBufferDirect to use WebGL line mode instead of triangle mode
    const mutableBatchedMesh = batchedMesh as any
    mutableBatchedMesh.isMesh = false
    mutableBatchedMesh.isLine = true
    mutableBatchedMesh.isLineSegments = true
  }

  private _updateEntriesInBatchedMesh(uniqueGeometries: Map<GeometryUuid, UniqueGeometry>): boolean {
    // Create the BatchedMesh if we haven't already
    if (!this.batchedMesh) this._constructBatchedMesh(uniqueGeometries)

    // Process each uniqueGeometry one at a time
    for (let [geometryUuid, uniqueGeometry] of uniqueGeometries) {
      // Add the geometry to the BatchedMesh if we haven't added this uuid yet
      if (!this.bookkeeping.has(geometryUuid)) {
        const geometryIdInBatchedMesh = this.batchedMesh!.addGeometry(uniqueGeometry.geometry)
        this.bookkeeping.set(geometryUuid, { geometryIdInBatchedMesh, usedInstanceIds: [], unusedInstanceIds: [] })
      }
      const bookkeeping = this.bookkeeping.get(geometryUuid)!

      // Reset all the _previous_ instances of this uniqueGeometry by setting them as invisible and
      // keeping track of the "free" instanceIds (there is currently no way of completely removing a
      // not-needed-anymore instance from BatchedMesh in three.js, hence we do it this way)
      for (let instanceId of bookkeeping.usedInstanceIds) {
        this.batchedMesh!.setVisibleAt(instanceId, false)
        bookkeeping.unusedInstanceIds.push(instanceId)
      }
      bookkeeping.usedInstanceIds = []

      // Loop through all the _current_ instances and set them up
      for (let renderableInstance of uniqueGeometry.instances) {
        // Try to reuse old instances freed up by the loop above, or create new instances if needed
        let instanceId
        if (bookkeeping.unusedInstanceIds.length > 0) {
          instanceId = bookkeeping.unusedInstanceIds.pop()!
        } else if (this.instancesUsed < this.batchedMesh!.maxInstanceCount) {
          instanceId = this.batchedMesh!.addInstance(bookkeeping.geometryIdInBatchedMesh)
          this.instancesUsed++
        } else {
          // If we end up here, we have exhausted all available instances in the entire BatchedMesh.
          // We need to abort, recreate the BatchedMesh with a higher instance count and rerun everything
          return false
        }

        // Set the instance as visible and set the transform for the instance
        this.batchedMesh!.setVisibleAt(instanceId, true)
        this.batchedMesh!.setMatrixAt(instanceId, renderableInstance.transform)
        bookkeeping.usedInstanceIds.push(instanceId)
      }
    }
    return true
  }

  /**
   * Update the BatchedMesh with a set of unique geometries and their associated lists of instances.
   *
   * NOTE: The BatchedMeshForRenderables class is only supposed to be reused with the same set of
   * unique geometries across multiple update() calls, i.e. where only the lists of instances changes
   * between each update() call. This method takes care of updating the instances, but does NOT
   * support e.g. removing old geometries altogether. This is handled by RenderGroupV3 in the layer
   * above, which takes care to only reuse a BatchedMeshForRenderables if it consists of the same
   * set of UniqueGeometries.
   */
  update(uniqueGeometries: Map<GeometryUuid, UniqueGeometry>) {
    // If we run out of instances in the BatchedMesh, we destroy and recreate it (with room to grow)
    const successfullyUpdated = this._updateEntriesInBatchedMesh(uniqueGeometries)
    if (!successfullyUpdated) {
      this._destructBatchedMesh()
      this._constructBatchedMesh(uniqueGeometries)
      this._updateEntriesInBatchedMesh(uniqueGeometries)
    }
  }
}
