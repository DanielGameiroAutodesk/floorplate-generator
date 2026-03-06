import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback, useMemo } from "preact/hooks"
import InputWithIcon from "src/lib/components/InputWithIcon/InputWithIcon"
import { roundUpToClosestFootInMetric } from "src/lib/components/LengthInput/formaUnitUtils"
import { Vector2 } from "three"
import { captureException } from "@sentry/browser"
import type { BasicSelection } from "./BasicBuildingProperties"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type { BasicBuilding } from "src/integrations/building-systems-basic-building/lib/types"
import { getPolygonWithHolesFromSpace } from "src/integrations/building-systems-basic-building/lib/utils"
import type { PolygonXY } from "src/lib/geometry/polygonXY"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { RightMenuPanelContainer } from "src/lib/components/RightMenu/RightMenuPanelContainer"
import { RightMenuPanelContentGrid } from "src/lib/components/RightMenu/RightMenuPanelContentGrid"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

function polygonWithWidth(polygon: PolygonXY, width: number): PolygonXY {
  const [v1, v2, , v4] = polygon
  const v1v2 = [v2.x - v1.x, v2.y - v1.y] as [number, number]
  const currentWidth = (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
  const newWidth = new Vector2()
  const factor = width / currentWidth
  if (!isFinite(factor)) {
    // Log to get more insight into when this can happen
    captureException(new Error("polygonWithWidth: factor is not finite"), {
      tags: { owner: "building-systems" },
      extra: { width, currentWidth, polygon },
    })
    return polygon
  }
  newWidth.set(...v1v2).multiplyScalar(factor)
  return [v1, { x: v1.x + newWidth.x, y: v1.y + newWidth.y }, { x: v4.x + newWidth.x, y: v4.y + newWidth.y }, v4]
}

function polygonWithLength(polygon: PolygonXY, length: number): PolygonXY {
  const [v1, v2, , v4] = polygon
  const v1v4 = [v4.x - v1.x, v4.y - v1.y] as [number, number]
  const currentLength = (v1v4[0] ** 2 + v1v4[1] ** 2) ** 0.5
  const factor = length / currentLength
  if (!isFinite(factor)) {
    // Log to get more insight into when this can happen
    captureException(new Error("polygonWithLength: factor is not finite"), {
      tags: { owner: "building-systems" },
      extra: { length, currentLength, polygon },
    })
    return polygon
  }
  const newLen = new Vector2().set(...v1v4).multiplyScalar(factor)
  return [v1, v2, { x: v2.x + newLen.x, y: v2.y + newLen.y }, { x: v1.x + newLen.x, y: v1.y + newLen.y }]
}

function polygonIsRectangular(_polygon: PolygonXY): boolean {
  const polygon = _polygon.filter((p, i, l) => {
    const next = l[(i + 1) % l.length]
    return next.x !== p.x || next.y !== p.y
  })
  const vec2a = new Vector2()
  const vec2b = new Vector2()
  const errorMargin = 1e-5
  if (polygon.length !== 4) return false
  const [v1, v2, v3, v4] = polygon
  vec2a.set(v2.x - v1.x, v2.y - v1.y)
  vec2b.set(v3.x - v2.x, v3.y - v2.y)
  if (Math.abs(vec2a.dot(vec2b)) > errorMargin) return false
  vec2a.set(v4.x - v3.x, v4.y - v3.y)
  vec2b.set(v1.x - v4.x, v1.y - v4.y)
  if (Math.abs(vec2a.dot(vec2b)) > errorMargin) return false
  return true
}

function getPolygonWidth(polygon: PolygonXY) {
  const [v1, v2] = polygon
  const v1v2 = [v2.x - v1.x, v2.y - v1.y]
  return (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
}

function getPolygonLength(polygon: PolygonXY) {
  const [, v1, v2] = polygon
  const v1v2 = [v2.x - v1.x, v2.y - v1.y]
  return (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
}

export default function WidthAndLength({ selections }: { selections: BasicSelection[] }) {
  const actionAPI = useActionAPI()
  const t = useTranslator()
  const isImperial = useIsImperial()

  const data = useMemo(() => {
    const widths: number[] = []
    const lengths: number[] = []
    for (const selection of selections) {
      for (const floorIndex of selection.floorIndices) {
        const floor = selection.building.floors[floorIndex]
        if (Object.keys(floor.spaces).length > 1) {
          return
        }
        const space = floor.spaces[Object.keys(floor.spaces)[0]]
        const polygonWithHoles = getPolygonWithHolesFromSpace(space, floor.graph)
        const polygon = polygonWithHoles.polygon
        if (polygonWithHoles.holes.length !== 0 || !polygonIsRectangular(polygon)) {
          return
        }
        widths.push(getPolygonWidth(polygon))
        lengths.push(getPolygonLength(polygon))
      }
    }
    const width = widths.every((v) => Math.abs(v - widths[0]) < 1e-5) ? widths[0] : undefined
    const length = lengths.every((v) => Math.abs(v - lengths[0]) < 1e-5) ? lengths[0] : undefined
    return { width, length }
  }, [selections])

  const updateGeometry = useCallback(
    (polygonMapper: (polygon: PolygonXY, value: number) => PolygonXY, newValue: number) => {
      const actions: Action[] = []
      for (const selection of selections) {
        const updatedBuilding: BasicBuilding = {
          ...selection.building,
          floors: selection.building.floors.map((floor, index) => {
            if (!selection.floorIndices.includes(index)) return floor
            const graph = { vertices: { ...floor.graph.vertices }, edges: floor.graph.edges }
            const spaces = { ...floor.spaces }
            for (const spaceId of Object.keys(spaces)) {
              const space = spaces[spaceId]
              const updatedPolygon = polygonMapper(
                space.polygon.map((v) => floor.graph.vertices[v]),
                newValue,
              )
              updatedPolygon.forEach((v, i) => {
                const vertexId = space.polygon[i]
                graph.vertices[vertexId] = { id: vertexId, x: v.x, y: v.y }
              })
            }
            return { ...floor, graph, spaces }
          }),
        }
        actions.push(
          ...BasicBuildingAPI.actions.createUpdateActions(
            selection.buildingPath,
            selection.buildingElement,
            updatedBuilding,
            actionAPI,
          ),
        )
      }
      actionAPI.apply("Update width and length", actions)
    },
    [selections, actionAPI],
  )

  if (!data) return null

  return (
    <RightMenuPanelContainer style={{ paddingBottom: "12px" }}>
      <RightMenuPanelContentGrid>
        <InputWithIcon
          id={"width"}
          label={t(($) => $.building.properties.widthLabel)}
          unit={"length"}
          icon={"W"}
          value={data.width}
          onChange={(width) => updateGeometry(polygonWithWidth, width)}
          isMixed={data.width === undefined}
          metricMin={isImperial ? roundUpToClosestFootInMetric(1) : 1}
          metricMax={isImperial ? roundUpToClosestFootInMetric(1000) : 1000}
          canEditProposal={canEditProposalSignal.value}
        />
        <InputWithIcon
          id={"length"}
          label={t(($) => $.building.properties.lengthLabel)}
          unit={"length"}
          icon={"L"}
          value={data.length}
          onChange={(length) => updateGeometry(polygonWithLength, length)}
          isMixed={data.length === undefined}
          feetStep={0.5}
          metricStep={0.1}
          metricMin={isImperial ? roundUpToClosestFootInMetric(1) : 1}
          metricMax={isImperial ? roundUpToClosestFootInMetric(1000) : 1000}
          canEditProposal={canEditProposalSignal.value}
        />
      </RightMenuPanelContentGrid>
    </RightMenuPanelContainer>
  )
}
