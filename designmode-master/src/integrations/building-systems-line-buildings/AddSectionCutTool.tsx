import type { BufferGeometry, Matrix4 } from "three"
import { Group, Mesh } from "three"
import { EditModeLineBuildingVisuals } from "./LineBuildingVisuals"
import { GraphToolVisual } from "./EditVisuals"
import { useGetLineBuildingLiveVisuals } from "./getLineBuildingLiveVisuals"
import { useEffect, useMemo, useState } from "preact/compat"
import { lineBuildingApi } from "./lineBuildingApi"
import type { AddSectionCutData } from "./helpers/sectionDragging"
import { getAddSectionCutData, getUpdatedSectionPropsAfterSectionAdd } from "./helpers/sectionDragging"
import { SectionCutVisual } from "./SectionCutVisuals"
import { moveGraphToCenterLine } from "./helpers/lineAlignment"
import { useUpdateLineBuildingElement } from "./elementApiHooks"
import { SectionAddLengthInputBox } from "./FloatingInputBox/SectionAddLengthInputBox"
import { mousePosition } from "src/core/useMousePosition"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { useIsImperial } from "src/lib/unitSettings"

export function AddSectionCutTool({
  parameters,
  worldMatrix,
  transSideGraph,
  initVertices,
  dbClickedElementId,
  exitTool,
}: {
  parameters: any
  worldMatrix: Matrix4
  transSideGraph: GraphZ
  initVertices: { x: number; y: number; z: number; id: string }[]
  dbClickedElementId: string
  exitTool: () => void
}) {
  const imperialFlag = useIsImperial()
  const updateElement = useUpdateLineBuildingElement(dbClickedElementId, worldMatrix)

  const [addSectionCutData, setAddSectionCutData] = useState<undefined | AddSectionCutData>(undefined)

  const hitBoxes = useMemo(() => {
    return lineBuildingApi.getSectionHitBoxes(parameters)
  }, [parameters])

  const targetMeshes = useMemo(() => {
    const targetGroup = new Group()
    Object.values(hitBoxes).forEach((hitBox: any) => {
      const hitBoxGeo: BufferGeometry = hitBox.geometry.clone()
      hitBoxGeo.applyMatrix4(worldMatrix)
      const mesh = new Mesh(hitBoxGeo)
      mesh.name = hitBox.hitBoxID
      targetGroup.add(mesh)
    })
    return targetGroup
  }, [hitBoxes, worldMatrix])

  useEffect(() => {
    const mousemove = () => {
      const hitTargets = mousePosition.intersectObjects([targetMeshes])
      const addSectionCutData = getAddSectionCutData(
        hitTargets,
        transSideGraph,
        parameters.sectionProps,
        parameters.floorHeight,
        parameters.width,
        parameters.lineAlignment,
        imperialFlag,
      )
      setAddSectionCutData(addSectionCutData)
    }
    const mousedown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const hitTargets = mousePosition.intersectObjects([targetMeshes])
      const addSectionCutData = getAddSectionCutData(
        hitTargets,
        transSideGraph,
        parameters.sectionProps,
        parameters.floorHeight,
        parameters.width,
        parameters.lineAlignment,
        imperialFlag,
      )
      if (!addSectionCutData) return
      const updatedSectionProps = getUpdatedSectionPropsAfterSectionAdd({
        sectionProps: parameters.sectionProps,
        addSectionCutData,
      })
      const updatedParameters = { ...parameters, sectionProps: updatedSectionProps }
      const centerGraph = moveGraphToCenterLine(transSideGraph, parameters)
      updateElement(centerGraph, updatedParameters)
    }
    const mouseup = (e: MouseEvent) => {
      if (e.button !== 0) return
      exitTool()
    }

    document.addEventListener("mousemove", mousemove)
    document.addEventListener("mousedown", mousedown)
    document.addEventListener("mouseup", mouseup)
    return () => {
      document.removeEventListener("mousemove", mousemove)
      document.removeEventListener("mousedown", mousedown)
      document.removeEventListener("mouseup", mouseup)
    }
  }, [targetMeshes, transSideGraph, parameters, imperialFlag, exitTool, updateElement])

  const liveVisuals = useGetLineBuildingLiveVisuals({
    parameters,
    transSideGraph,
    initVertices,
  })
  return (
    <>
      {liveVisuals && (
        <EditModeLineBuildingVisuals building={liveVisuals.building} transform={liveVisuals.buildingTranslation} />
      )}
      {
        <GraphToolVisual
          roofLines={liveVisuals.roofLines}
          liveVertices={liveVisuals.liveVertices}
          roofLineActive={true}
        />
      }
      {addSectionCutData && (
        <SectionCutVisual
          addSectionCutData={addSectionCutData}
          transSideGraph={transSideGraph}
          sectionProps={parameters.sectionProps}
          floorHeight={parameters.floorHeight}
          width={parameters.width}
          lineAlignment={parameters.lineAlignment}
        />
      )}
      {addSectionCutData && <SectionAddLengthInputBox addSectionCutData={addSectionCutData} />}
    </>
  )
}
