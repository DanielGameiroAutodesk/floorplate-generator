import type { Transform } from "@spacemakerai/element-types"
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import { Matrix4 } from "three"
import sceneManager from "src/core/three/sceneManager"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import type { Renderable } from "src/integrations/renderables/renderable"
import { simplestyleToInternalFormat } from "src/integrations/extensions-generators/preview"
import { isProjectImperial } from "src/lib/unitSettings"

/**
 * API for rendering GeoJSON
 */
interface RenderGeojsonAPI {
  /**
   * Named scope for a specific use of the API. This eases the cleanup of rendered objects when the scope is no longer needed.
   */
  renderScope: string

  /**
   * Add/update a rendered object.
   * Sending a second call using the same .id for the RenderedObject will replace any previous objects with the same id in this renderScope
   * @param toAdd
   */
  upsert: (toAdd: RenderedObject) => void

  /**
   * Removes an object from this renderScope
   * @param name
   */
  remove: (name: string) => void

  /**
   * Removes all objects and frees memory used by this renderScope
   */
  cleanup: () => void
}

/**
 * Object to be rendered by the designmode rendering engine
 */
type RenderedObject = {
  id: string
  geojson: FeatureCollection<Geometry, GeoJsonProperties>
  transform: Transform
}
const renderGroups: Map<string, RenderGroup> = new Map()
const renderablesPerScope: Map<string, Renderable[]> = new Map()

export function createRenderGeojsonApi(renderScope: string): [RenderGeojsonAPI, cleanup: () => void] {
  const api: RenderGeojsonAPI = {
    renderScope,

    upsert(toAdd) {
      if (!renderGroups.has(renderScope)) {
        const group = new RenderGroup(renderScope)
        renderGroups.set(renderScope, group)
        sceneManager.overlay.scene.add(group)
      }

      if (!renderablesPerScope.has(renderScope)) {
        renderablesPerScope.set(renderScope, [])
      }

      const isImperial = isProjectImperial()

      const group = renderGroups.get(renderScope)!
      const renderables = [...(toAdd.geojson.features ?? [])]
        // In GeoJSON (e.g. geojson.io) the last item is rendered on top.
        // In the element system/designmode rendering the first item is rendered on top.
        .reverse()
        .flatMap((feature, i) => {
          const [internalFeature, internalProperties] = simplestyleToInternalFormat(feature)
          return buildRenderablesFromGeojson(
            internalFeature,
            undefined,
            new Matrix4().fromArray(toAdd.transform),
            internalProperties.color ?? "#555555",
            internalProperties.opacity ?? 0.5,
            `PreViewResult/${i}`,
            undefined,
            isImperial,
            internalProperties,
          )
        })

      if (renderablesPerScope.get(toAdd.id)) {
        renderablesPerScope.delete(toAdd.id)
      }
      renderablesPerScope.set(toAdd.id, renderables)

      group.update(Array.from(renderablesPerScope.values()).flat())
      sceneManager.render(false, true)
    },
    remove(name) {
      const group = renderGroups.get(renderScope)

      if (!group) {
        throw new Error(`No objects exists in context [${renderScope}]`)
      }

      const currentObjects = renderablesPerScope.get(name)
      if (!currentObjects) {
        throw new Error(`No object exists with name [${name}]`)
      }

      renderablesPerScope.delete(name)
      group.update(Array.from(renderablesPerScope.values()).flat())
      sceneManager.render(true, true)
    },
    cleanup() {
      const group = renderGroups.get(renderScope)

      if (!group) {
        return
      }

      group?.dispose()
      renderGroups.delete(renderScope)
      renderablesPerScope.clear()

      sceneManager.scene.remove(group)
      sceneManager.render(true, true)
    },
  }

  return [api, api.cleanup]
}
