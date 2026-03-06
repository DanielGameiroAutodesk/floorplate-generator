import { Vector3 } from "three"
import { LineSegmentsGeometry, LineSegments2 } from "three/examples/jsm/Addons.js"
import { extractTerrainCutPoints, intersectWithBbox } from "./utilities/extractCutGeometries"
import { Earcut } from "three/src/extras/Earcut.js"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { MeshBVH, SAH } from "three-mesh-bvh"
import * as THREE from "three"
import { cutTerrainMaterial } from "./utilities/cutMaterials"
import { computed } from "@preact/signals"
import { sectionBoxRenderAPI } from "./utilities/sectionBoxRenderer"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const terrainBVHSignal = computed(() => {
  // TODO: Unsure of clone here
  return new MeshBVH(terrainSignal.value.mesh.geometry.clone(), {
    maxLeafTris: 1,
    maxDepth: 40,
    strategy: SAH,
  })
})

export function createSectionCutLineForTerrain(
  sectionBoxAsFeature: ExtrudedPolygonFeature | undefined,
  terrainBVH: MeshBVH,
) {
  if (!sectionBoxAsFeature) return
  const sides = sectionBoxAsFeature.geometry.coordinates[0].map((startPoint, index) => {
    const endPoint =
      sectionBoxAsFeature.geometry.coordinates[0][(index + 1) % sectionBoxAsFeature.geometry.coordinates[0].length]
    return {
      intersectionPoints: extractTerrainCutPoints(
        terrainBVH,
        { x: startPoint[0], y: startPoint[1] },
        { x: endPoint[0], y: endPoint[1] },
      ),
      normal: { x: startPoint[1] - endPoint[1], y: endPoint[0] - startPoint[0] },
    }
  })
  const allIntersectionPoints = sides.flatMap((side) => side.intersectionPoints)

  const positionsArray: Float32Array = new Float32Array(
    allIntersectionPoints
      .map((point, n) => {
        const nextPoint = allIntersectionPoints[(n + 1) % allIntersectionPoints.length]
        return [point.x, point.y, point.z, nextPoint.x, nextPoint.y, nextPoint.z]
      })
      .flat(),
  )
  const linesGeo = new LineSegmentsGeometry().setPositions(positionsArray)
  const mesh = new LineSegments2(linesGeo, cutTerrainMaterial)

  const pointsInAllSides = sides.reduce((total, side) => total + side.intersectionPoints.length + 2, 0)
  const allPoz = new Float32Array(pointsInAllSides * 3)
  const allTriangulations: number[][] = []

  sides.forEach(({ intersectionPoints, normal }, n) => {
    const start = new Vector3(
      intersectionPoints[0].x,
      intersectionPoints[0].y,
      sectionBoxAsFeature.properties.elevation,
    )
    const end = new Vector3(
      intersectionPoints[intersectionPoints.length - 1].x,
      intersectionPoints[intersectionPoints.length - 1].y,
      sectionBoxAsFeature.properties.elevation,
    )
    const side = [start, ...intersectionPoints, end]

    // Compute xy rotation angle needed to transform cutting plane to lie along x-axis
    const xyAngle = -Math.atan2(normal.y, normal.x)

    const filled = sides
      .filter((_, i) => i < n)
      .map((s) => s.intersectionPoints.length + 2)
      .reduce((acc, cur) => acc + cur, 0)
    const coords2D: number[] = []
    for (let i = 0; i < side.length; i++) {
      const { x, y, z } = side[i]
      // Rotate coords so that cutting plane in now in the xy-plane (and hence the coordinates are a 2D rep of the polygon)
      coords2D.push(-z, x * Math.sin(xyAngle) + y * Math.cos(xyAngle))
      allPoz[(i + filled) * 3] = x
      allPoz[(i + filled) * 3 + 1] = y
      allPoz[(i + filled) * 3 + 2] = z
    }
    allTriangulations.push(Earcut.triangulate(coords2D))
  })

  const flatIdxzList = allTriangulations
    .map((tri, k) =>
      tri.map(
        (num) =>
          num +
          sides
            .filter((_, i) => i < k)
            .map((s) => s.intersectionPoints.length + 2)
            .reduce((acc, cur) => acc + cur, 0),
      ),
    )
    .flat()
  const allTrianglesByCoords: number[] = []
  flatIdxzList.forEach((index) => {
    const x = allPoz[index * 3]
    const y = allPoz[index * 3 + 1]
    const z = allPoz[index * 3 + 2]
    allTrianglesByCoords.push(x, y, z)
  })

  return { mesh, allTrianglesByCoords, positionsArray }
}

export function SectionBoxTerrainCutLine({ sectionBoxAsFeature }: { sectionBoxAsFeature: ExtrudedPolygonFeature }) {
  const terrainBVH = terrainBVHSignal.value
  const terrainMesh = terrainSignal.value.mesh
  const terrainBbox = terrainMesh.geometry.boundingBox
  const modifiedSectionBoxAsFeature = terrainBbox && intersectWithBbox(sectionBoxAsFeature, terrainBbox)
  const sectionCutLine = modifiedSectionBoxAsFeature
    ? createSectionCutLineForTerrain(modifiedSectionBoxAsFeature, terrainBVH)
    : createSectionCutLineForTerrain(sectionBoxAsFeature, terrainBVH)

  // need to use useObjectLifecycle_TEMPORARY_FIX to support thick lines
  sectionBoxRenderAPI.useObjectLifecycle_TEMPORARY_FIX(sectionCutLine?.mesh)
  if (sectionCutLine) {
    sectionBoxRenderAPI.upsert({
      id: "terrainCutSurface",
      transform: new THREE.Matrix4().toArray(),
      mode: "normal",
      spec: "sectionTerrainMesh",
      geometryData: {
        position: new Float32Array(sectionCutLine?.allTrianglesByCoords),
      },
    })
  }
  return null
}
