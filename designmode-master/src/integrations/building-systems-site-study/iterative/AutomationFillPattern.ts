import { useMemo } from "preact/hooks"
import { BufferAttribute, Group, Mesh } from "three"

import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { HATCHED_TEXTURE_MATERIAL } from "src/lib/three/materials/hatched-texture-material"

import { create2DPolygon } from "src/integrations/renderables/2d-polygon"

type Polygon = [number, number][]

export function useAutomationFillPattern(polygons: Polygon[]) {
  // TODO: On hover of individual cells, fill with #cdeaf7z
  const renderable = useMemo(() => {
    const bufferGeometries = polygons.map((polygon) => create2DPolygon([polygon]).toNonIndexed())

    const group = new Group()
    if (bufferGeometries.length > 0)
      group.add(
        ...bufferGeometries.map((geo) => {
          geo.setAttribute("uv", new BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2, false))
          for (let i = 0; i < geo.attributes.position.count; i++) {
            const x = geo.attributes.position.getX(i)
            const y = geo.attributes.position.getY(i)
            geo.attributes.uv.setXY(i, x / 3, y / 3) // TODO: Where is this magic constant coming from. Any way we could make the material reusable without needing to define this?
          }
          const mesh = new Mesh(geo, HATCHED_TEXTURE_MATERIAL)
          mesh.position.z += 10
          return mesh
        }),
      )
    return group
  }, [polygons])
  useObjectLifecycle(renderable, true, sceneManager.overlay.scene)
}
