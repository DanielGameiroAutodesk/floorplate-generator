import { Matrix4, Vector3 } from "three"
import type { BasicBuilding } from "src/integrations/building-systems-basic-building/lib/types"
import { projectGeoLocationSignal } from "src/core/project/project"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import { elementState } from "src/core/elements/ElementState"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { polygonGeometryToShape } from "src/lib/three/Shape/shapeUtils"
import type { Polygon } from "geojson"
import type { Transform } from "@spacemakerai/element-types"
import { createUrn, newChildKey, newId, newRevision } from "src/lib/element/urn"
import type { FormaElement } from "@spacemakerai/element-types"
import { PROJECT_ID } from "src/core/project/project"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { shapeToPolygonFeature } from "src/lib/three/Shape/shapeUtils"
import { featureToTerrainShape } from "src/integrations/basic-elements/api/terrainShape"
import { analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function completeSiteLimit(shape: Shape, context: "proposal" | "base") {
  const batchId = newId()
  const internalId = newId()
  const id = `${batchId}+${internalId}`

  const element: FormaElement = {
    urn: createUrn("basic", PROJECT_ID, id, newRevision()),
    properties: {
      category: "site_limit",
    },
  }
  const state = elementState
  const feature = shapeToPolygonFeature(shape)

  const container = ElementContainer.fromDraftElement(element, undefined, {
    terrainShape: featureToTerrainShape(feature, element),
    footprint: feature,
    terrainTexture: undefined,
    volumeMesh: undefined,
    buildingFloors3DSketch_UNSTABLE: undefined,
  })

  // Tracked with new tracking in useDrawSiteLimit.
  analyticsAndBreadcrumbsForActions("Add site_limit")
  state.edit(({ addElement }) => addElement(context, { key: newChildKey(), urn: element.urn }, container))
}

type TransformedBasicBuilding = { transform: Matrix4; building: BasicBuilding }

export function BasicBuildingDuplicate() {
  const project = projectGeoLocationSignal.value
  const actionAPI = useActionAPI()
  const toGlobalVec = new Matrix4().makeTranslation(new Vector3(project!.point[0], project!.point[1], 0))
  return (
    <>
      <button
        onClick={() => {
          const basicBuildings: TransformedBasicBuilding[] = []
          const siteLimits: Shape[] = []
          elementState.currentSnapshot.value.nodes.forEach((node) => {
            if (BasicBuildingAPI.isBasicBuilding(node.element)) {
              basicBuildings.push({
                building: node.element.representations.__INTERNAL__.data,
                transform: node.globalMatrix,
              })
            }
            if (node.element.properties?.category === "site_limit") {
              siteLimits.push(
                polygonGeometryToShape(
                  node.elementContainer.representations.footprint?.geometry as Polygon,
                  node.globalMatrix,
                  terrainSignal.value.elevationAt,
                ),
              )
            }
          })

          const globlBasics = basicBuildings.map((basicBuilding) => {
            const globalTransform = basicBuilding.transform.clone().multiply(toGlobalVec)
            return {
              transform: globalTransform.toArray(),
              building: basicBuilding.building,
            }
          })
          const globalSiteLimit = siteLimits.map((siteLimit) => {
            return {
              ...siteLimit,
              vertices: siteLimit.vertices.map((vertex) => ({
                x: vertex.x + project!.point[0],
                y: vertex.y + project!.point[1],
                z: vertex.z,
              })),
            }
          })
          void navigator.clipboard.writeText(
            JSON.stringify({ basicBuildings: globlBasics, siteLimits: globalSiteLimit }),
          )
        }}
      >
        Copy buildings
      </button>
      <button
        onClick={() => {
          void navigator.clipboard.readText().then((text) => {
            const { basicBuildings, siteLimits } = JSON.parse(text) as {
              basicBuildings: { transform: Transform; building: BasicBuilding }[]
              siteLimits: Shape[]
            }
            console.log({ basicBuildings, siteLimits })

            const localSiteLimit = siteLimits.map((siteLimit) => {
              return {
                ...siteLimit,
                vertices: siteLimit.vertices.map((vertex) => ({
                  x: vertex.x - project!.point[0],
                  y: vertex.y - project!.point[1],
                  z: vertex.z,
                })),
              }
            })
            const actions = basicBuildings.flatMap((basicBuilding) => {
              const globalTransform = new Matrix4().fromArray(basicBuilding.transform)
              const toLocalVec = toGlobalVec.clone().invert()
              const localTransform = globalTransform.multiply(toLocalVec)

              return BasicBuildingAPI.actions.createAddActions(
                basicBuilding.building,
                localTransform.toArray(),
                actionAPI,
              ).actions
            })
            actionAPI.apply("Merge basic buildings", actions, undefined)

            for (let i = 0; i < basicBuildings.length; i++) {
              dispatchBuildingEvent("basic_building", EventName.Add, "copy")
            }

            localSiteLimit.forEach((siteLimit) => {
              const sl = { ...siteLimit, vertices: siteLimit.vertices.map(({ x, y, z }) => new Vector3(x, y, z)) }
              completeSiteLimit(sl, "proposal")
            })
          })
        }}
      >
        Paste buildings
      </button>
    </>
  )
}
