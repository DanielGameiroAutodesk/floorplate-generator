import { useMemo } from "preact/compat"
import * as THREE from "three"
import { BufferAttribute, BufferGeometry, Color, Matrix4, Vector2 } from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"

export const EditModeLineBuildingVisuals = ({ building, transform }: any) => {
  const renderApi = useRenderAPI("default")
  const visuals = useMemo(() => {
    if (!building) return new THREE.Group()

    const { geometry, lineGeometry: lines } = building
    const transformMatrix = transform ? new Matrix4().fromArray(transform) : new Matrix4().identity()

    const group = new THREE.Group()

    if (geometry) {
      const bufferGeo = new BufferGeometry()
      bufferGeo.setAttribute("position", new BufferAttribute(geometry.attributes.position.array, 3))
      bufferGeo.setAttribute("normal", new BufferAttribute(geometry.attributes.normal.array, 3, false))
      bufferGeo.setAttribute("color", new BufferAttribute(geometry.attributes.color.array, 3, true))

      const material = new THREE.MeshBasicMaterial({ vertexColors: true })
      const mesh = new THREE.Mesh(bufferGeo, material)
      group.add(mesh)
    }

    if (lines) {
      const linesGeo = new LineSegmentsGeometry().setPositions(lines.attributes.positions)
      const color = "#0696D7"
      const linewidth = lines?.uniforms?.lineWidth || 2
      const lineMaterial = new LineMaterial({
        color: new Color(color).getHex(),
        linewidth: linewidth,
        resolution: new Vector2(window.screen.width, window.screen.height),
        name: "Box line",
      })

      const mesh = new LineSegments2(linesGeo, lineMaterial)
      group.add(mesh)
    }

    group.applyMatrix4(transformMatrix)
    return group
  }, [building, transform])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(visuals)

  return null
}
