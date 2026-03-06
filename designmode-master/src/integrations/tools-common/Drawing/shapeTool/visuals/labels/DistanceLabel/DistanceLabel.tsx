import { forwardRef, useEffect, useMemo } from "preact/compat"
import { createLabel, getScreenAngle } from "src/integrations/tools-common/Drawing/shapeTool/visuals/labels/labelUtils"
import type { Object3D, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import { colors } from "src/lib/colors"
import { projectPositionToSurface } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import { useTranslator } from "src/i18n"

type Props = {
  vertices: [Vector3, Vector3]
  color?: string
  onTerrain?: boolean
  useImperialUnits: boolean
  horizontal?: boolean
}

export const DistanceLabel = forwardRef<Object3D, Props>(
  ({ vertices, color = colors.blue50, onTerrain = false, useImperialUnits, horizontal = false }, ref) => {
    const t = useTranslator()
    const camera = sceneManager.camera

    const lengthLabel = useMemo(() => {
      const [start, end] = vertices
      const label = createLabel(start, end, camera, useImperialUnits, t, 15, color, horizontal)
      const labelPos = start.clone().sub(end).divideScalar(2).add(end)

      if (onTerrain) {
        const terrain = sceneManager.scene.getObjectByName("Terrain")
        projectPositionToSurface(labelPos, terrain, labelPos)
      }

      label.position.copy(labelPos)
      return label
    }, [vertices, camera, useImperialUnits, t, color, onTerrain, horizontal])

    useEffect(() => {
      const onchange = () => {
        const [start, end] = vertices
        lengthLabel.material.rotation = getScreenAngle(start, end, camera, sceneManager.canvas)
      }
      sceneManager.controls.addEventListener("change", onchange)
      return () => {
        sceneManager.controls.removeEventListener("change", onchange)
      }
    }, [camera, lengthLabel, vertices])

    useEffect(() => {
      if (vertices[0] && vertices[0].distanceTo(vertices[1]) < 0.001) return
      if (ref) {
        if (ref instanceof Function) {
          ref(lengthLabel)
        } else {
          ref.current = lengthLabel
        }
      }
      sceneManager.scene.add(lengthLabel)
      sceneManager.render()
      return () => {
        sceneManager.scene.remove(lengthLabel)
        lengthLabel.material.dispose()
        lengthLabel.material.map?.dispose()
        lengthLabel.geometry.dispose()
        sceneManager.render()
      }
    }, [lengthLabel, ref, vertices])

    return null
  },
)
