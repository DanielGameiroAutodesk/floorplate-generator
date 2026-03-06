import type { BasicBuilding } from "src/integrations/building-systems-basic-building/lib/types"
import { useEffect, useState } from "preact/hooks"
import type { Matrix4 } from "three"
import type { InternalPath } from "src/lib/element/path"
import { SlicingBuildingVisuals } from "./SlicingBuildingVisuals"
import { elementState } from "src/core/elements/ElementState"
import { resetFadeAllExceptSignal, setFadeAllExceptSignalValue } from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"

const InputLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  height: "20px",
} as const

function useHideAndFade(path: InternalPath) {
  useEffect(() => {
    HiddenPaths.setPathHidden(path, true)
    return () => {
      HiddenPaths.setPathHidden(path, false)
    }
  }, [path])

  useEffect(() => {
    setFadeAllExceptSignalValue([path])
    return () => resetFadeAllExceptSignal()
  }, [path])
}

const SlicingBuildingInner = ({
  path,
  basicBuilding,
  worldTransform,
}: {
  path: string
  basicBuilding: BasicBuilding
  worldTransform: Matrix4
}) => {
  useHideAndFade(path)

  const [floorSlice, setFloorSlice] = useState(() => {
    return basicBuilding.floors.length
  })
  const [directionAngle, setDirectionAngle] = useState(0)
  const [slicePercentage, setSlicePercentage] = useState(0)

  return (
    <div>
      <SlicingBuildingVisuals
        basicBuilding={basicBuilding}
        worldTransform={worldTransform}
        floorSlice={floorSlice}
        verticalDirectionAngle={directionAngle}
        verticalSlicingDistance={slicePercentage}
      />
      <div style={InputLineStyle}>
        <div>{"Floor slice"}</div>
        <input
          type={"range"}
          value={floorSlice}
          min={0}
          max={basicBuilding.floors.length}
          step={0.01}
          onChange={(e) => {
            const value = parseFloat(e.currentTarget.value)
            setFloorSlice(value)
          }}
        />
      </div>
      <div style={InputLineStyle}>
        <div>{"Vertical Slicing Angle"}</div>
        <input
          type={"range"}
          value={directionAngle}
          min={0}
          max={2 * Math.PI}
          step={0.01}
          onChange={(e) => {
            const value = parseFloat(e.currentTarget.value)
            setDirectionAngle(value)
          }}
        />
      </div>
      <div style={InputLineStyle}>
        <div>{"Vertical Slicing distance"}</div>
        <input
          type={"range"}
          value={slicePercentage}
          min={0}
          max={1}
          step={0.01}
          onChange={(e) => {
            const value = parseFloat(e.currentTarget.value)
            setSlicePercentage(value)
          }}
        />
      </div>
    </div>
  )
}

export const SlicingBuilding = ({ path, basicBuilding }: { path: string; basicBuilding: BasicBuilding }) => {
  const snapshot = elementState.currentSnapshot.value
  const [open, setOpen] = useState(false)

  const worldTransform = snapshot.getNodeOrThrow(path).globalMatrix

  return (
    <>
      <br />
      <br />
      <br />
      <br />
      <button
        onClick={() => {
          setOpen(!open)
        }}
      >
        {open ? "End Slicing" : "Start Slicing"}
      </button>
      {open && <SlicingBuildingInner path={path} basicBuilding={basicBuilding} worldTransform={worldTransform} />}
    </>
  )
}
