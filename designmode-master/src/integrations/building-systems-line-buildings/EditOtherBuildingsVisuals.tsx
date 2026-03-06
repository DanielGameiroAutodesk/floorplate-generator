import type { OtherBuildingDragSnapData } from "./dragToOtherBuilding"
import { useMemo } from "preact/compat"
import { lineBuildingApi } from "./lineBuildingApi"
import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, Vector2 } from "three"
import * as THREE from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"

export function EditOtherBuildingsVisuals({
  otherBuildingsSnapData,
  dragVertexData,
}: {
  otherBuildingsSnapData: OtherBuildingDragSnapData
  dragVertexData?: any
}) {
  const renderApi = useRenderAPI("default")

  const otherLineBuildingsGeos = useMemo(() => {
    const otherBuildingGeos: any = {}
    const otherBuildings = otherBuildingsSnapData.otherLineBuildings
    for (let otherBuilding of otherBuildings) {
      const parameters = otherBuilding?.element?.properties?.generator?.parameters
      const { geometry, lineGeometry } = lineBuildingApi.run(parameters)
      const worldTransform = otherBuilding.worldTransform || new Matrix4()
      otherBuildingGeos[otherBuilding.path] = { geometry, lineGeometry, transform: worldTransform }
    }
    return otherBuildingGeos
  }, [otherBuildingsSnapData])

  const snappedToPath = dragVertexData?.otherBuildingSnapData?.path

  const visuals = useMemo(() => {
    const groups = new Group()
    for (let path of Object.keys(otherLineBuildingsGeos)) {
      if (path === snappedToPath) continue
      const group = new Group()
      const { geometry, lineGeometry, transform } = otherLineBuildingsGeos[path]

      if (geometry) {
        const bufferGeo = new BufferGeometry()
        bufferGeo.setAttribute("position", new BufferAttribute(geometry.attributes.position.array, 3))
        bufferGeo.setAttribute("normal", new BufferAttribute(geometry.attributes.normal.array, 3, false))
        bufferGeo.setAttribute("color", new BufferAttribute(geometry.attributes.color.array, 3, true))

        const material = new THREE.MeshLambertMaterial({ vertexColors: true })
        const mesh = new THREE.Mesh(bufferGeo, material)
        group.add(mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true
      }

      if (lineGeometry) {
        const linesGeo = new LineSegmentsGeometry().setPositions(lineGeometry.attributes.positions)
        // const color = lines?.uniforms?.color || "#222"
        const color = lineGeometry?.uniforms?.color || "#9999"
        const linewidth = lineGeometry?.uniforms?.lineWidth || 2
        const lineMaterial = new LineMaterial({
          color: new Color(color).getHex(),
          linewidth: linewidth,
          resolution: new Vector2(window.screen.width, window.screen.height),
          name: "Box line",
        })

        const mesh = new LineSegments2(linesGeo, lineMaterial)
        group.add(mesh)
      }
      group.applyMatrix4(transform)
      groups.add(group)
    }
    return groups
  }, [otherLineBuildingsGeos, snappedToPath])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(visuals)
  return <></>
}
