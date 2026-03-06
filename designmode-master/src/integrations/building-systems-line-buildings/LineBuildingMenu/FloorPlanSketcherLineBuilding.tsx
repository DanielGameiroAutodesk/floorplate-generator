import { useMemo } from "preact/compat"
import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type {
  InputFloor,
  InputUnit,
  InputUnitPolygon,
  OutputData,
} from "src/integrations/building-systems-common/FloorPlanSketcherTypes"
import { PROJECT_ID } from "src/core/project/project"
import { useFloorPlanTemplates } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import { canEditProposalSignal } from "src/core/edit-access-state"

const SmFps = reactWcWrapper<any>("sm-fps-elements")

export function makeDummyFloors(polygon: InputUnitPolygon, numberOfStories = 1, storyHeight = 3) {
  const floors: InputFloor[] = []
  let elevation = 0
  for (let i = 0; i < numberOfStories; i++) {
    const floorID = `abc-${i}`
    const unitID = `cba-${i}`
    const unit: InputUnit = { id: unitID, polygon, holes: [], name: "LIVING_UNIT", type: "LIVING_UNIT" }
    const floor = {
      id: floorID,
      height: storyHeight,
      elevation,
      units: { [unit.id]: unit },
      outerShape: [],
      contentType: "EMPTY",
    }
    floors.push(floor)
    elevation += storyHeight
  }
  return floors
}

function getInitFloor(initData: any) {
  if (initData) return initData
  const polygon: InputUnitPolygon = [
    [0, 0],
    [20, 0],
    [20, 14],
    [0, 14],
    [0, 0],
  ].map(([x, y]) => ({ x, y }))
  return makeDummyFloors(polygon, 4, 3)
}

const WrapperStyle = `
  position: fixed;
  left: 0px;
  top: 0px;
  z-index: 100000000000000000000000000000000;
  width: 100vw;
  height: 100vh;
`

export const FloorPlanSketcherLineBuilding = ({
  close,
  onMake,
  initData,
  outline,
}: {
  close: () => void
  onMake: (stackId: string, data: any) => void
  initData: any
  outline: number[][]
}) => {
  useLazyLoadScript("/web-components/sm-floor-plan-sketcher-elements/floor-plan-sketcher.js", "building-systems")
  const canEdit = canEditProposalSignal.value
  const initFloors = useMemo(() => {
    return getInitFloor(initData)
  }, [initData])
  const floorPlanTemplates = useFloorPlanTemplates()

  const onComplete = (e: CustomEvent<OutputData>) => {
    const payloads = getOnMakePayloads(e.detail)
    Object.entries(payloads).forEach(([stackId, floors]) => onMake(stackId, floors))
    e.stopPropagation()
    close()
  }
  const onCancel = (e: CustomEvent) => {
    e.stopPropagation()
    close()
  }
  return (
    <div
      style={WrapperStyle}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        close()
        e.stopPropagation()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <SmFps
        canEdit={canEdit}
        floors={initFloors}
        outline={outline}
        onApply={onComplete}
        onComplete={onComplete}
        onClose={onCancel}
        onCancel={onCancel}
        floorPlanTemplates={floorPlanTemplates}
        projectId={PROJECT_ID}
      />
    </div>
  )
}

function getOnMakePayloads(data: any): any {
  const updatedStacks: any = data.updatedStacks
  if (updatedStacks) {
    return Object.fromEntries(
      Object.entries(updatedStacks as object).map(([stackId, stackData]) => [stackId, stackData.newFloors]),
    )
  }

  return Object.fromEntries(
    Object.entries(data as object).map(([stackId, stackData]) => [stackId, stackData.newFloors]),
  )
}
