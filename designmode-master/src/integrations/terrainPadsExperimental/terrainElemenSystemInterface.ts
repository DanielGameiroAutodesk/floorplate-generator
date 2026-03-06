import type { ElementSystem } from "src/core/element-systems"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { terrainApi } from "./api/terrainPadApi"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import { genericSaveError, type NotPersistedContainers, ok, type SavingSuccess } from "src/core/elements-saving/result"
import { elementState } from "src/core/elements/ElementState"
import { parseUrn } from "src/lib/element/urn"
import type { FormaElement } from "@spacemakerai/element-types"
import { validateIsElementResponse } from "src/lib/elementFormatUtils"
import { elementResponseToMap } from "@spacemakerai/elements-client"
import { Mesh } from "three"
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"
import { gzip } from "pako"
import { request } from "src/lib/request"
import { getTerrainCustomData } from "src/core/elements/terrain-data"

export const CUSTOM_INTEGRATION = "terrain_pads"

export const terrainElementSystem: ElementSystem = {
  saveHandler: async (elementsToSave: NotPersistedContainers[], authcontext: string) => {
    const currentTerrain = elementState.currentTerrainSignal.peek()
    if (!currentTerrain) {
      throw new Error("No terrain element in proposal")
    }
    const { id: elementId, revision } = parseUrn(currentTerrain.urn)
    const mesh = currentTerrain.mesh
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox()
    }
    const currentTerrainOps = currentTerrain.element.properties.terrain_mode_operations ?? []
    const uploadLinkResult = await fetch(
      `/api/terrain/elements/upload-link?authcontext=${authcontext}&elementId=${elementId}&revision=${revision}`,
    ).then((r) => r.json())
    const uploadLink = uploadLinkResult.url
    const glb: ArrayBuffer = await new Promise((resolve, reject) => {
      const exportmesh = new Mesh(mesh.geometry.clone())
      exportmesh.geometry.rotateX(-Math.PI / 2)
      new GLTFExporter().parse(exportmesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
    })
    const glbGz = gzip(glb)
    await request(uploadLink, {
      method: "PUT",
      headers: { "Content-Type": "model/gltf-binary", "Content-Encoding": "gzip" },
      body: glbGz,
    })
    const body = {
      refPoint: currentTerrain.element.properties.geoReference.refPoint,
      bbox: currentTerrain.element.properties.bbox,
      srid: currentTerrain.element.properties.geoReference.srid,
      baseUrn: currentTerrain.data.baseTerrain?.baseTerrainUrn,
      licensing: currentTerrain.element.metadata?.licensing,
      additionalProperties: {
        terrain_mode_operations: currentTerrainOps,
      },
    }
    const putUrl = `/api/terrain/elements/${elementId}/revisions/${revision}?authcontext=${authcontext}`

    const result = await fetch(putUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        return res.json()
      })
      .then((r) => {
        //optimistic update of terrain element in state
        const formaElement: FormaElement = {
          ...currentTerrain.element,
          urn: currentTerrain.element.urn,
        }
        return { [r.urn]: formaElement }
      })
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
      .then((res) =>
        ok<SavingSuccess>({
          updatedElementsFromSystem: res,
        }),
      )
      .catch((e) => genericSaveError(e))
    return [result]
  },

  generateSelectables: (
    container: ElementContainer,
  ):
    | {
        selectionMode: SelectionMode
        selectables: Selectable[]
      }
    | undefined => {
    //if (!isFlagActive(LDFlag.TerrainPads)) return
    const element = container.element
    if (!isTerrainElement(element)) return

    const terrainData = getTerrainCustomData(container)
    if (!terrainData) return
    const initTerrain = terrainData.baseTerrain?.baseTerrainGeometry
    if (!initTerrain) return

    const selectables: Selectable[] = terrainApi.getTerrainPadSelectables(element, initTerrain)

    return {
      selectionMode: "custom-selectables-only",
      selectables,
    }
  },
}
