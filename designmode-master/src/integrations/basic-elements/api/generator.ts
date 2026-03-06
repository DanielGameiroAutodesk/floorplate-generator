import type { Action } from "src/core/legacy-actions"
import { generateAreaTrees, generateLineTrees } from "src/integrations/basic-elements/trees/generatorV2"
import type { Feature, LineString } from "geojson"
import type { Matrix4 } from "three"
import { Box2, Raycaster, Vector2, Vector3 } from "three"

import type { InternalPath } from "src/lib/element/path"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast } from "src/core/terrain/2d-raytracer"
import type { Proposal } from "src/core/elements/Proposal"
import { isDefined } from "src/lib/array"

const reusableVec3 = new Vector3()

export function generateChildren(
  batchId: string,
  revision: string,
  properties: BasicElementProperties,
  path: InternalPath,
  elementWorldTransform: Matrix4,
  feature: Feature,
  terrainSampler: TerrainSamplerData,
  proposal: Proposal,
): Action<"create">[] | undefined {
  if (!["Polygon", "LineString"].includes(feature.geometry.type)) return []
  const coordinates =
    feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : (feature.geometry as LineString).coordinates

  const box2ForFeature = new Box2()
  const vec2s = coordinates.map(([x, y]) => {
    reusableVec3.set(x, y, 0)
    reusableVec3.applyMatrix4(elementWorldTransform)
    return new Vector2(reusableVec3.x, reusableVec3.y)
  })
  box2ForFeature.setFromPoints(vec2s)
  const objects = [...proposal.snapshot.nodes.values()]
    .filter(
      (node) =>
        !node.elementContainer.element.properties?.virtual &&
        node.elementContainer.element.properties?.category !== "vegetation",
    )
    .filter((node) => {
      const box2 = node.bbox2.getOrCompute()
      if (!box2) return false
      return box2.intersectsBox(box2ForFeature)
    })
    .map((node) => node.volumeMeshWithAcceleratedRaycast.getOrCompute())
    .filter(isDefined)

  const raycaster = new Raycaster()
  const elevationAt = (x: number, y: number): number => {
    if (!properties.treePlacerGenerator?.placeOnRoof && !properties.treeLineGenerator?.placeOnRoof) {
      return raycast(x, y, terrainSampler)
    }
    raycaster.set(new Vector3(x, y, 10000), new Vector3(0, 0, -1))
    const intersections = raycaster.intersectObjects(objects)
    const terrainZ = raycast(x, y, terrainSampler)
    if (intersections.length > 0) {
      return Math.max(intersections[0].point.z, terrainZ)
    }
    return terrainZ
  }
  if (properties.treeLineGenerator && feature.geometry.type === "LineString") {
    return generateLineTrees(
      batchId,
      revision,
      path,
      feature,
      properties.treeLineGenerator,
      elementWorldTransform,
      elevationAt,
    )
  } else if (properties.treePlacerGenerator && feature.geometry.type === "Polygon") {
    return generateAreaTrees(
      batchId,
      revision,
      path,
      feature.geometry,
      properties.treePlacerGenerator,
      elementWorldTransform,
      elevationAt,
    )
  } else {
    return undefined
  }
}
