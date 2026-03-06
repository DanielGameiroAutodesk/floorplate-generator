import sceneManager from "src/core/three/sceneManager"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Material, Mesh, Object3D } from "three"
import { Group } from "three"

/**
 * API for rendering GLBs
 */
interface RenderGlbAPI {
  /**
   * Named scope for a specific use of the API. This eases the cleanup of rendered objects when the scope is no longer needed.
   */
  renderScope: string

  /**
   * Add/update a rendered object.
   * Sending a second call using the same .id for the RenderedObject will replace any previous objects with the same id in this renderScope
   * @param toAdd
   */
  upsert: (toAdd: RenderedObject) => Promise<void>

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

/**
 * Object to be rendered by the designmode rendering engine
 */
type RenderedObject = { id: string; glb: ArrayBuffer }
const groupsPerScope: Map<string, Group> = new Map()

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

export function createRenderGlbApi(renderScope: string): [RenderGlbAPI, cleanup: () => void] {
  const api: RenderGlbAPI = {
    renderScope,
    async upsert(toAdd) {
      if (!groupsPerScope.has(renderScope)) {
        const group = new Group()
        groupsPerScope.set(renderScope, group)
        sceneManager.scene.add(group)
      }

      const group = groupsPerScope.get(renderScope)!
      const gltf = await new GLTFLoader().parseAsync(toAdd.glb, "")
      const object = gltf.scene

      const currentObject = group.getObjectByName(toAdd.id)
      if (currentObject) {
        recusivelyDispose(currentObject)
        group.remove(currentObject)
      }
      object.name = toAdd.id

      // Rotate x,y,z to x,-z,y
      object.matrixAutoUpdate = false
      /* prettier-ignore */
      object.matrix.set(
        1, 0, 0, 0,
        0, 0, -1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
      )

      group.add(object)

      sceneManager.render(false, true)
    },

    remove(name) {
      const group = groupsPerScope.get(renderScope)

      if (!group) {
        throw new Error(`No objects exists in context [${renderScope}]`)
      }

      const currentObject = group.getObjectByName(name)
      if (!currentObject) {
        throw new Error(`No object exists with name [${name}]`)
      }

      recusivelyDispose(currentObject)

      group.remove(currentObject)
      sceneManager.render(true, true)
    },

    cleanup() {
      const group = groupsPerScope.get(renderScope)

      if (!group) {
        return
      }

      recusivelyDispose(group)
      for (const child of group.children) {
        group.remove(child)
      }

      groupsPerScope.delete(renderScope)
      sceneManager.scene.remove(group)
      sceneManager.render(true, true)
    },
  }

  return [api, api.cleanup]
}
