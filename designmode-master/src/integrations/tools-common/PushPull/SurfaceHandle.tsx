import polylabel from "polylabel"
import type { Matrix4 } from "three"
import { AlwaysDepth, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector2, Vector3 } from "three"
import { create2DPolygon } from "src/integrations/renderables/2d-polygon"
import { pixelsToMetersAtPosition } from "src/integrations/tools-common/AffineTooling/utils"
import { colors } from "src/lib/colors"
import { mousePosition } from "src/core/useMousePosition"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import sceneManager from "src/core/three/sceneManager"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"

type ExtrudedFeatureSurface = "roof" | number

const surfaceMaterial = new MeshBasicMaterial({
  color: colors.blue70,
  opacity: 0.3,
  transparent: true,
  depthFunc: AlwaysDepth,
})

function createRoofMesh(feature: ExtrudedPolygonFeature, transform: Matrix4) {
  const roofGeo = create2DPolygon(feature.geometry.coordinates)
  const roof = new Mesh(roofGeo, surfaceMaterial)
  roof.translateZ(feature.properties.height + feature.properties.elevation)
  roof.applyMatrix4(transform)
  roof.updateMatrixWorld(true)
  roof.name = "Roof"
  return roof
}

function createRoofCenterHandle(feature: ExtrudedPolygonFeature, transform: Matrix4) {
  const footprint = feature.geometry.coordinates
  const centerHandlePos = polylabel(footprint)
  const z = feature.properties.height + feature.properties.elevation
  const centerHandle = new VertexHandle(new Vector3(centerHandlePos[0], centerHandlePos[1], z).applyMatrix4(transform))
  return centerHandle
}

const angleVec = new Vector2()
function createWallMesh(feature: ExtrudedPolygonFeature, index: number, transform: Matrix4) {
  const footprint = feature.geometry.coordinates[0].slice(0, -1)
  const v1 = footprint[index]
  const v2 = footprint[(index + 1) % footprint.length]
  const width = ((v2[0] - v1[0]) ** 2 + (v2[1] - v1[1]) ** 2) ** 0.5
  const { height, elevation } = feature.properties
  const geometry = new PlaneGeometry(width, height)
  const mesh = new Mesh(geometry, surfaceMaterial)
  const dx = v2[0] - v1[0]
  const dy = v2[1] - v1[1]
  mesh.position.set(v1[0] + dx / 2, v1[1] + dy / 2, elevation + height / 2)
  mesh.rotateX(0.5 * Math.PI)
  angleVec.set(dx, dy)
  mesh.rotateY(angleVec.angle())
  mesh.applyMatrix4(transform)
  mesh.updateMatrixWorld(true)
  mesh.name = "Wall"
  return mesh
}

function createWallCenterHandle(feature: ExtrudedPolygonFeature, index: number, transform: Matrix4) {
  const footprint = feature.geometry.coordinates[0].slice(0, -1)
  const v1 = footprint[index]
  const v2 = footprint[(index + 1) % footprint.length]
  const dx = v2[0] - v1[0]
  const dy = v2[1] - v1[1]
  const { height, elevation } = feature.properties
  const centerHandle = new VertexHandle(
    new Vector3(v1[0] + dx / 2, v1[1] + dy / 2, elevation + height / 2).applyMatrix4(transform),
  )
  return centerHandle
}

const HANDLE_HOVER_DISTANCE = 8

class SurfaceHandle extends Group {
  surfaceMesh: Mesh
  centerHandle: VertexHandle
  elementPath: string
  surface: number | "roof"
  isVisible: boolean = false
  constructor(path: string, feature: ExtrudedPolygonFeature, surface: ExtrudedFeatureSurface, transform: Matrix4) {
    super()
    this.elementPath = path
    this.surface = surface
    if (surface === "roof") {
      this.surfaceMesh = createRoofMesh(feature, transform)
      this.centerHandle = createRoofCenterHandle(feature, transform)
    } else {
      this.surfaceMesh = createWallMesh(feature, surface, transform)
      this.centerHandle = createWallCenterHandle(feature, surface, transform)
    }
    this.surfaceMesh.visible = false
    this.centerHandle.visible = false
    this.add(this.surfaceMesh, this.centerHandle)
    this.name = `${path} - ${surface}`
  }

  get cursorDistanceToHandle() {
    return mousePosition.ray.distanceToPoint(this.centerHandle.position)
  }

  get maxHandleDistance() {
    const maxHandleDistance = pixelsToMetersAtPosition(
      HANDLE_HOVER_DISTANCE,
      sceneManager.camera,
      this.centerHandle.position,
    )
    return maxHandleDistance
  }

  get isCursorNearInteractionPoint() {
    return this.cursorDistanceToHandle < this.maxHandleDistance
  }

  intersect() {
    if (sceneManager.is2D) {
      const distance = this.cursorDistanceToHandle
      return distance < this.maxHandleDistance * 3 ? distance : undefined
    }
    const intersection = mousePosition.intersectObject(this.surfaceMesh)
    return intersection[0]?.distance
  }

  hover() {
    this.surfaceMesh.visible = this.isCursorNearInteractionPoint
    this.isVisible = true
    this.centerHandle.visible = this.isVisible
    sceneManager.render()
  }

  unhover() {
    this.surfaceMesh.visible = false
    this.centerHandle.visible = false
    sceneManager.render()
  }
}

export default SurfaceHandle
