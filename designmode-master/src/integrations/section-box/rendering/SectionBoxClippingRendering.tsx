import {
  sectionBoxPreviewSignal,
  isEditingSignal,
  selectedSectionBoxSignal,
  setIsEditingSignal,
  showOutlineSignal,
} from "src/integrations/section-box/state"
import sceneManager from "src/core/three/sceneManager"
import { constructBoxGeometryFromSectionBox, type SectionBox } from "src/integrations/section-box/tooling/sectionBox"
import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import { Matrix4 } from "three"
import { useEffect } from "preact/hooks"
import { getClippingPlanesFromSectionBox } from "./utilities/getClippingPlanes"
import { SectionBoxTerrainCutLine } from "./TerrainCutRendering"
import { SectionBoxMeshCutLine } from "./MeshCutRendering"
import { sectionBoxRenderAPI } from "./utilities/sectionBoxRenderer"
import { DesignModeEvents } from "src/core/events/events"
import { toolAPI } from "src/core/toolsState"
import { rotateSectionBoxToolCfg } from "src/integrations/section-box/tooling/toolbar/SectionBoxToolbar"

export function renderSectionBoxOutline(sectionBox: SectionBox, mode: "faint" | "normal") {
  const geometry = constructBoxGeometryFromSectionBox(sectionBox)
  const outlines = calculateEdgesGeometry(geometry)
  sectionBoxRenderAPI.upsert({
    id: "sectionBox",
    transform: new Matrix4().toArray(),
    mode,
    spec: "sectionBoxOutline",
    geometryData: {
      position: outlines,
    },
  })
}

export function SectionBoxRendering() {
  const selectedSectionBox = selectedSectionBoxSignal.value
  const sectionBoxPreview = sectionBoxPreviewSignal.value
  const isEditing = isEditingSignal.value

  useEffect(() => {
    return () => {
      sectionBoxRenderAPI.cleanup()
      sceneManager.sectionBoxClipping.reset()
    }
  }, [])

  const displayMeshCutLine = () => setIsEditingSignal(false)
  const hideMeshCutLine = () => {
    if (toolAPI.currentToolSignal.peek().id !== rotateSectionBoxToolCfg.id) setIsEditingSignal(true)
  }

  useEffect(() => {
    DesignModeEvents.addListener("tool.edit.start", hideMeshCutLine)
    DesignModeEvents.addListener("tool.edit.end", displayMeshCutLine)
    return () => {
      DesignModeEvents.removeListener("tool.edit.start", hideMeshCutLine)
      DesignModeEvents.removeListener("tool.edit.end", displayMeshCutLine)
    }
  }, [])

  const sectionBoxAsFeature = sectionBoxPreview || selectedSectionBox?.box
  if (!sectionBoxAsFeature) return null
  const mode = sectionBoxPreview ? "faint" : "normal"

  const clippingPlanes = getClippingPlanesFromSectionBox(sectionBoxAsFeature)
  if (showOutlineSignal.value) renderSectionBoxOutline(sectionBoxAsFeature, mode)
  sceneManager.sectionBoxClipping.setClippingPlanes(clippingPlanes)

  return (
    <>
      <SectionBoxTerrainCutLine sectionBoxAsFeature={sectionBoxAsFeature} />
      {!isEditing && <SectionBoxMeshCutLine sectionBoxAsFeature={sectionBoxAsFeature} />}
    </>
  )
}
