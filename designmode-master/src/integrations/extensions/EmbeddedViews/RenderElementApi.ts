import type { Child, Transform, Urn } from "forma-elements"
import type { Feature } from "geojson"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { getRenderables, type RenderableV2 } from "src/core/preview-element-state"
import sceneManager from "src/core/three/sceneManager"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { bindFormaElementLookupForBoxMap, type FormaElementLookup } from "src/lib/element/lookup"
import { getPathToUrn, ROOT_KEY } from "src/lib/element/path"
import type { TerrainShape } from "src/lib/element/types"
import { GeometryConstants } from "src/lib/three/geometryUtils"
import { type BufferGeometry, Group, Matrix4, type Material, type Mesh, type Object3D } from "three"

type Previewable = {
  elements: FormaElementLookup
  volumeMeshes: Map<Urn, BufferGeometry>
  footprints: Map<Urn, Feature>
  terrainShapes: Map<Urn, TerrainShape>
}

/**
 * API for rendering GLBs
 */
interface renderElementApi {
  /**
   * Named scope for a specific use of the API. This eases the cleanup of rendered objects when the scope is no longer needed.
   */
  renderScope: string

  /**
   * Add/update a rendered object.
   * Sending a second call using the same .id for the RenderedObject will replace any previous objects with the same id in this renderScope
   * @param toAdd
   */
  upsert: (toAdd: {
    id: string
    rootUrn: Urn
    elements: {
      urn: Urn
      parentPath?: string
      child?: Omit<Child, "urn">
      transform: Transform
    }[]
  }) => Promise<void>

  /**
   * Removes an object from this renderScope
   * @param name
   */
  remove: (name: string) => void

  /**
   * Removes all objects and frees memory used by this renderScrop
   */
  cleanup: () => void
}

function recusivelyDispose(object: Object3D) {
  object.traverse((child) => {
    if ("geometry" in child) {
      ;(child as Mesh).geometry.dispose()
    }
    if ((child as Mesh).material) {
      if (Array.isArray((child as Mesh).material)) {
        ;((child as Mesh).material as Material[]).forEach((m) => m.dispose())
      } else {
        ;((child as Mesh).material as Material).dispose()
      }
    }
  })
}

const groupsPerScope: Map<string, Group> = new Map()

// ASYNC PROBLEMS:
// const isUpserting: Record<string, Symbol> = {}
export function createRenderElementApi(renderScope: string): [renderElementApi, cleanup: () => void] {
  const api: renderElementApi = {
    renderScope,
    async upsert(toAdd) {
      const renderScopeOverlay = `${renderScope}-overlay`

      if (!groupsPerScope.has(renderScope)) {
        const group = new Group()
        group.name = renderScope
        groupsPerScope.set(renderScope, group)
        sceneManager.scene.add(group)
      }
      if (!groupsPerScope.has(renderScopeOverlay)) {
        const group = new Group()
        group.name = renderScopeOverlay
        groupsPerScope.set(renderScopeOverlay, group)
        sceneManager.overlay.scene.add(group)
      }
      const { elements, representations } = await downloadAllElementData(
        new Set(toAdd.elements.map((element) => element.urn)),
      )
      const formaElementLookup = bindFormaElementLookupForBoxMap(elements)

      const preview: Previewable = {
        elements: formaElementLookup,
        volumeMeshes: representations.volumeMesh,
        footprints: representations.footprint,
        terrainShapes: representations.terrainShape,
      }

      const group3d = groupsPerScope.get(renderScope)!
      const group2d = groupsPerScope.get(renderScopeOverlay)!

      const currentObject3d = group3d.getObjectByName(toAdd.id)
      if (currentObject3d) {
        recusivelyDispose(currentObject3d)
        group3d.remove(currentObject3d)
      }
      const currentObject2d = group3d.getObjectByName(toAdd.id)
      if (currentObject2d) {
        recusivelyDispose(currentObject2d)
        group3d.remove(currentObject2d)
      }

      const renderables3D: RenderableV2[] = []
      const renderables2D: RenderableV2[] = []

      for (const element of toAdd.elements) {
        const renderables = getRenderables(
          element.urn,
          preview.elements,
          preview.volumeMeshes,
          preview.footprints,
          preview.terrainShapes,
          getPathToUrn(preview.elements, element.urn),
          new Set([ROOT_KEY]),
        )

        // TODO: APPLY TRANSFORM/MATRIX FROM USER AS WELL:
        const renderableWithAppliedTranform = (r: RenderableV2) =>
          GeometryConstants.IDENTITY.equals(r.matrix)
            ? r
            : { ...r, geometry: r.geometry.clone().applyMatrix4(r.matrix) }

        const renderables3dWithAppliedTransforms = renderables
          .filter((r) => r.scene === "3d")
          .map((r) => {
            return renderableWithAppliedTranform({
              ...r,
              matrix: r.matrix.clone().multiply(new Matrix4().fromArray(element.transform)),
            })
          })
        const renderables2dWithAppliedTransforms = renderables
          .filter((r) => r.scene === "2d")
          .map((r) => {
            const matrix = r.matrix.clone()
            matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.

            return renderableWithAppliedTranform({
              ...r,
              matrix: r.matrix.clone().multiply(new Matrix4().fromArray(element.transform)),
            })
          })
        renderables3D.push(...renderables3dWithAppliedTransforms)
        renderables2D.push(...renderables2dWithAppliedTransforms)
      }
      group3d.add(new RenderGroup(toAdd.id, renderables3D))
      group2d.add(new RenderGroup(toAdd.id, renderables2D))
      sceneManager.render(true, true)
    },

    remove(name) {
      function removeByName(_renderScope: string) {
        const group = groupsPerScope.get(_renderScope)
        if (!group) {
          throw new Error(`No objects exists in context [${_renderScope}]`)
        }

        const currentObject = group.getObjectByName(name)
        if (!currentObject) {
          throw new Error(`No object exists with name [${name}]`)
        }
        recusivelyDispose(currentObject)

        group.remove(currentObject)
        sceneManager.render(true, true)
      }
      removeByName(renderScope)
      removeByName(`${renderScope}-overlay`)
    },

    cleanup() {
      function cleanupRenderScope(_renderScope: string) {
        const group = groupsPerScope.get(_renderScope)

        if (!group) {
          return
        }

        recusivelyDispose(group)
        for (const child of group.children) {
          group.remove(child)
        }

        groupsPerScope.delete(renderScope)
        sceneManager.scene.remove(group)
      }
      const renderScopeOverlay = `${renderScope}-overlay`

      cleanupRenderScope(renderScope)
      cleanupRenderScope(renderScopeOverlay)
      sceneManager.render(true, true)
    },
  }

  return [api, api.cleanup]
}
