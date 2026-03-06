import { useMemo } from "preact/compat"
import { isDefined } from "src/lib/array"
import type { InternalPath } from "src/lib/element/path"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { MultiRingPolygon } from "./polygonMesh"
import {
  createFillMeshFromPositions,
  createFillPositionArray,
  createWireframeMeshFromPositions,
  createWireframePositionArray,
} from "./polygonMesh"

export function GrossFloorAreas({ gfaToInspect }: { gfaToInspect?: ElementGrossFloorAreas[] }) {
  const gfasExist = isDefined(gfaToInspect)
  return <>{gfasExist && <RenderGrossFloorAreas gfaToInspect={gfaToInspect} />}</>
}

function RenderGrossFloorAreas({ gfaToInspect }: { gfaToInspect: ElementGrossFloorAreas[] }) {
  const renderAPI = useRenderAPI("default")

  const elementsGfasV2 = Object.values(gfaToInspect)

  const batchFill = useMemo(() => {
    const positions = elementsGfasV2
      .flatMap((elementGfa) => elementGfa.gfaPolygons)
      .filter((multiRingPolygon) => multiRingPolygon.length)
      .map(createFillPositionArray)
    return createFillMeshFromPositions(positions, elementsGfasV2)
  }, [elementsGfasV2])

  const batchWireframe = useMemo(() => {
    const positions = elementsGfasV2
      .flatMap((elementGfa) => elementGfa.gfaPolygons)
      .filter((multiRingPolygon) => multiRingPolygon.length)
      .map(createWireframePositionArray)
    return createWireframeMeshFromPositions(positions)
  }, [elementsGfasV2])

  renderAPI.useObjectLifecycle_TEMPORARY_FIX(batchFill)
  renderAPI.useObjectLifecycle_TEMPORARY_FIX(batchWireframe)

  return <></>
}

export type ElementGrossFloorAreas = {
  isUnderlying: boolean
  path: InternalPath
  gfaPolygons: MultiRingPolygon[]
}
