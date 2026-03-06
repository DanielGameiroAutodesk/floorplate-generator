import styles from "./BuildingTooltip.module.css"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { Sphere, Vector3 } from "three"
import type { Position } from "geojson"
import debounce from "lodash/debounce"
import { tooltipState } from "./tooltip-state"
import { useRecoilValue } from "recoil"
import { elementState } from "src/core/elements/ElementState"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import { hoveredIdsArraySignal } from "src/core/selection/selectionState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const BuildingTooltip = () => {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  const tooltipTexts = useRecoilValue(tooltipState)
  const allHovered = hoveredIdsArraySignal.value

  const worldPosition = useMemo(() => {
    const hovered = allHovered[0]
    const node = proposal.snapshot.getNode(hovered)
    if (!node) return
    const volumeMesh = getVolumeMeshWithTerrainFallback(proposal, node.urn)
    const geojson = node.elementContainer.representations.footprint
    const worldTransform = node.globalMatrix

    const reusedVector = new Vector3()
    const sphere = new Sphere()

    if (volumeMesh?.position) {
      const positions = volumeMesh.position
      for (let p = 0; p < positions.length; p += 3) {
        reusedVector.fromArray(positions.slice(p, p + 3))
        reusedVector.applyMatrix4(worldTransform)
        sphere.expandByPoint(reusedVector)
      }
    } else if (geojson) {
      let positions: Position[] = []
      switch (geojson.geometry.type) {
        case "Polygon":
          positions = geojson.geometry.coordinates.flat()
          break
        case "LineString":
          positions = geojson.geometry.coordinates
      }

      positions.forEach(([x, y]) => {
        const z = terrain.elevationAt(x, y)
        reusedVector.set(x, y, z)
        reusedVector.applyMatrix4(worldTransform)
        sphere.expandByPoint(reusedVector)
      })
    }

    let center = sphere.center
    return center
  }, [allHovered, proposal, terrain])

  const ref = useRef<HTMLDivElement>(null)
  const cameraEvents = cameraApi.cameraEvents

  useEffect(() => {
    const update = () => {
      if (!ref.current) return
      if (!worldPosition) return
      const screenPos = cameraApi.worldToScreen(worldPosition)
      ref.current.style.left = `${Math.floor(screenPos.x)}px`
      ref.current.style.top = `${window.innerHeight - Math.floor(screenPos.y)}px`
    }
    const set = debounce(update, 5)
    cameraEvents.addEventListener("change", set)
    return () => cameraEvents.removeEventListener("change", set)
  }, [worldPosition, ref, cameraEvents])

  const hoveredElementTooltipText = tooltipTexts.get(allHovered[0])
  if (!hoveredElementTooltipText) return null
  if (!worldPosition) return null

  const screenPos = cameraApi.worldToScreen(worldPosition)
  return (
    <div
      ref={ref}
      className={styles.TooltipContainer}
      style={{
        pointerEvents: "none",
        top: `${window.innerHeight - Math.floor(screenPos.y)}px`,
        left: `${Math.floor(screenPos.x)}px`,
      }}
    >
      <div className={styles.Tooltip}>
        <div className={styles.TooltipArrow} />
        {hoveredElementTooltipText}
      </div>
    </div>
  )
}
