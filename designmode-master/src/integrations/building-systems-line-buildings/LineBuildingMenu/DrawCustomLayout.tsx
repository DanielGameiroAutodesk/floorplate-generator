import { useCallback } from "preact/compat"
import { v4 as uuid } from "uuid"
import { FloorPlanSketcherLineBuilding, makeDummyFloors } from "./FloorPlanSketcherLineBuilding"
import { useMemo } from "preact/hooks"
import type { InputUnitPolygon } from "src/integrations/building-systems-common/FloorPlanSketcherTypes"
import { AnalyticsLegacy } from "src/core/analytics"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

function getBlockDistanceForSimpleCorner(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = width / Math.cos(absAngle - Math.PI / 2)
    const dist2 = width / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (width - width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.abs(shift)
}

function getCornerOutline({
  startLeg,
  endLeg,
  angle,
  width,
}: {
  startLeg: number
  endLeg: number
  angle: number
  width: number
}) {
  const blockDistance = getBlockDistanceForSimpleCorner(width, angle)

  let dx1
  let dx2, dy2
  let dx3, dy3
  let dx4, dy4
  let dx5
  if (angle > 0) {
    dx1 = startLeg + blockDistance

    dx2 = (endLeg + blockDistance) * Math.cos(angle)
    dy2 = (endLeg + blockDistance) * Math.sin(angle)

    dx3 = width * Math.cos(angle + Math.PI / 2)
    dy3 = width * Math.sin(angle + Math.PI / 2)

    dx4 = endLeg * Math.cos(angle + Math.PI)
    dy4 = endLeg * Math.sin(angle + Math.PI)

    dx5 = -startLeg
  } else {
    dx1 = startLeg

    dx2 = endLeg * Math.cos(angle)
    dy2 = endLeg * Math.sin(angle)

    dx3 = width * Math.cos(angle + Math.PI / 2)
    dy3 = width * Math.sin(angle + Math.PI / 2)

    dx4 = (endLeg + blockDistance) * Math.cos(angle + Math.PI)
    dy4 = (endLeg + blockDistance) * Math.sin(angle + Math.PI)

    dx5 = -(startLeg + blockDistance)
  }

  const [x0, y0] = [0, 0]
  const [x1, y1] = [dx1, 0]
  const [x2, y2] = [x1 + dx2, y1 + dy2]
  const [x3, y3] = [x2 + dx3, y2 + dy3]
  const [x4, y4] = [x3 + dx4, y3 + dy4]
  const [x5, y5] = [x4 + dx5, y4]

  return [
    [x0, y0],
    [x1, y1],
    [x2, y2],
    [x3, y3],
    [x4, y4],
    [x5, y5],
  ]
}

function getRectangleOutline({ width, length }: { width: number; length: number }) {
  return [
    [0, 0],
    [length, 0],
    [length, width],
    [0, width],
  ]
}

export const DrawCornerSection = ({
  startLeg,
  endLeg,
  width,
  angle,
  storyHeight,
  setOpen,
  addCustomLayout,
}: {
  startLeg: number
  endLeg: number
  width: number
  angle: number
  storyHeight: number
  setOpen: (open: boolean) => void
  addCustomLayout: (customLayout: CustomLayout) => void
}) => {
  const outline = useMemo(() => {
    return getCornerOutline({ startLeg, endLeg, angle, width })
  }, [startLeg, endLeg, angle, width])

  const initData = useMemo(() => {
    const polygon: InputUnitPolygon = [...outline, outline[0]].map(([x, y]) => ({ x, y }))
    const numberOfStories = 1
    return makeDummyFloors(polygon, numberOfStories, storyHeight).map((floor) => {
      return { ...floor, name: "middleFloor" }
    })
  }, [outline, storyHeight])

  const onMake = useCallback(
    (stackId: string, floors: any) => {
      const randomName = uuid().slice(0, 6)
      const customLayout: CustomLayout = {
        id: randomName,
        floors,
        sectionType: "Corner",
        startLeg,
        endLeg,
        width,
        angle,
      }
      addCustomLayout(customLayout)
    },
    [startLeg, endLeg, width, angle, addCustomLayout],
  )

  return (
    <FloorPlanSketcherLineBuilding
      onMake={(stackId, floors) => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Apply FPS", { fpsMode: "draw new" })
        onMake(stackId, floors)
      }}
      initData={initData}
      close={() => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Close FPS", { fpsMode: "draw new" })
        setOpen(false)
      }}
      outline={outline}
    />
  )
}

export const DrawRectangleSection = ({
  width,
  length,
  storyHeight,
  setOpen,
  addCustomLayout,
}: {
  width: number
  length: number
  storyHeight: number
  setOpen: (open: boolean) => void
  addCustomLayout: (customLayout: CustomLayout) => void
}) => {
  const outline = useMemo(() => {
    return getRectangleOutline({ width, length })
  }, [length, width])

  const initData = useMemo(() => {
    const polygon: InputUnitPolygon = [...outline, outline[0]].map(([x, y]) => ({ x, y }))
    const numberOfStories = 1
    return makeDummyFloors(polygon, numberOfStories, storyHeight).map((floor) => {
      return { ...floor, name: "middleFloor" }
    })
  }, [outline, storyHeight])

  const onMake = useCallback(
    (stackId: string, floors: any) => {
      const randomName = uuid().slice(0, 6)
      const customLayout: CustomLayout = {
        id: randomName,
        floors: floors,
        sectionType: "Rectangle",
        width,
        length,
      }
      addCustomLayout(customLayout)
    },
    [width, length, addCustomLayout],
  )

  return (
    <FloorPlanSketcherLineBuilding
      onMake={(stackId, floors) => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Apply FPS", { fpsMode: "draw new" })
        onMake(stackId, floors)
      }}
      initData={initData}
      close={() => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Close FPS", { fpsMode: "draw new" })
        setOpen(false)
      }}
      outline={outline}
    />
  )
}

export const EditCustomSection = ({
  customLayout,
  setOpen,
  updateCustomLayout,
  editType,
}: {
  customLayout: CustomLayout
  setOpen: (open: boolean) => void
  updateCustomLayout: any
  editType: string
}) => {
  const initData = useMemo(() => {
    return customLayout.floors
  }, [customLayout])

  const onMake = useCallback(
    (stackId: string, floors: any) => {
      const updatedFeature = { ...customLayout, floors }
      updateCustomLayout(updatedFeature)
    },
    [customLayout, updateCustomLayout],
  )
  const outline = useMemo(() => {
    if (customLayout.sectionType === "Corner") {
      const { startLeg, endLeg, width, angle } = customLayout
      return getCornerOutline({ startLeg, endLeg, width, angle })
    }
    const { width, length } = customLayout
    return getRectangleOutline({ width, length })
  }, [customLayout])

  return (
    <FloorPlanSketcherLineBuilding
      onMake={(stackId, floors) => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Apply FPS", { fpsMode: editType })
        onMake(stackId, floors)
      }}
      initData={initData}
      close={() => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Line Building - Close FPS", { fpsMode: editType })
        setOpen(false)
      }}
      outline={outline}
    />
  )
}
