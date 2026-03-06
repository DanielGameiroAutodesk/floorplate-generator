import type { Object3D, Scene } from "three"
import { BufferAttribute, BufferGeometry, Matrix4 } from "three"
import sceneManager from "src/core/three/sceneManager"
import { useEffect, useMemo } from "preact/hooks"
import type { Renderable, RenderingMode, RenderingSpec } from "src/integrations/renderables/renderable"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import type { Transform } from "@spacemakerai/element-types"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"

type GeometryData = {
  position?: Float32Array
  uv?: Float32Array
  normal?: Float32Array
  index?: number[]
  color?: Uint8Array
}

/**
 * API for rendering 3D elements
 */
export interface RenderAPI {
  /**
   * Named scope for a specific use of the API. Everything in the same scope will be rendered together, using certain optimizations.
   */
  renderScope: string
  /**
   * flag defining if this instance of the api will render to 3D or 2D (on terrain)
   */
  is2D: boolean

  /**
   * if true, visuals in this renderScope will occlude rays when calculating snapping
   */
  occludesSnapping: boolean

  /**
   * Add/update a rendered object.
   * Sending a second call using the same .name for the RenderedObject will replace any previous objects with the same name in this renderScope
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

  /** @deprecated We don't have a good alternative to this yet. This exposes a hook, which we don't want to do. The rest of the RenderAPI can be used in many use cases */
  useObjectLifecycle_TEMPORARY_FIX: (
    object?: Object3D,
    visible?: boolean,
    scene?: Scene,
    updateShadowMap?: boolean,
  ) => void
}

/**
 * Object to be rendered by the designmode rendering engine
 */
export type RenderedObject = {
  id: string
  geometryData: GeometryData

  /**
   * World transform of the object. Will be applied to the geometryData
   */
  transform: Transform

  /**
   * Name of the spec to use for this object
   */
  spec: RenderingSpec

  /**
   * mode within the given spec to use for this object
   */
  mode: RenderingMode
}

const reusableTransformMatrix: Matrix4 = new Matrix4()

function toBufferGeometry({ geometryData, id, transform }: RenderedObject) {
  const geometry = new BufferGeometry()
  if (geometryData.position) geometry.setAttribute("position", new BufferAttribute(geometryData.position, 3))
  if (geometryData.index) geometry.setIndex(geometryData.index)
  if (geometryData.color) geometry.setAttribute("color", new BufferAttribute(geometryData.color, 4, true))
  if (geometryData.normal) geometry.setAttribute("normal", new BufferAttribute(geometryData.normal, 3, true))

  geometry.name = id
  reusableTransformMatrix.fromArray(transform)
  geometry.applyMatrix4(reusableTransformMatrix)

  return geometry
}

function toRenderable(object: RenderedObject): Renderable {
  const geometry = toBufferGeometry(object)

  return {
    id: object.id,
    geometry: geometry,
    spec: object.spec,
    mode: object.mode,
  }
}

const renderGroups: Map<string, RenderGroup> = new Map()
const objectsPerScope: Map<string, Map<string, RenderedObject>> = new Map()
const renderablesPerScope: Map<string, Map<string, Renderable>> = new Map()

export function createRenderApi(
  renderScope: string = "default",
  occludesSnapping: boolean = false,
  is2D: boolean = false,
): [RenderAPI, cleanup: () => void] {
  const api: RenderAPI = {
    renderScope,
    occludesSnapping,
    is2D,
    upsert(toAdd) {
      if (!renderGroups.has(renderScope)) {
        let group = new RenderGroup(renderScope)
        if (occludesSnapping) {
          group.userData.occludesSnapping = occludesSnapping
        }
        const scene = is2D ? sceneManager.overlay.scene : sceneManager.scene
        scene.add(group)
        renderGroups.set(renderScope, group)
      }

      if (!objectsPerScope.has(renderScope)) {
        objectsPerScope.set(renderScope, new Map<string, RenderedObject>())
      }

      if (!renderablesPerScope.has(renderScope)) {
        renderablesPerScope.set(renderScope, new Map<string, Renderable>())
      }

      const renderGroup = renderGroups.get(renderScope)!
      const objects = objectsPerScope.get(renderScope)!
      const renderables = renderablesPerScope.get(renderScope)!
      objects.set(toAdd.id, toAdd)

      const renderable = toRenderable(toAdd)
      renderables.set(toAdd.id, renderable)

      renderGroup.update(Array.from(renderables.values()))
      sceneManager.render(false, true)
    },
    remove(name) {
      const renderGroup = renderGroups.get(renderScope)
      const objects = objectsPerScope.get(renderScope)
      const renderables = renderablesPerScope.get(renderScope)

      if (!renderGroup || !objects || !renderables) {
        throw new Error(`No objects exists in context [${renderScope}]`)
      }

      const currentObject = objects.get(name)
      if (!currentObject) {
        throw new Error(`No object exists with name [${name}]`)
      }

      objects.delete(name)
      renderables.delete(name)

      renderGroup.update(Array.from(renderables.values()))
      sceneManager.render(true, true)
    },

    cleanup() {
      const renderGroup = renderGroups.get(renderScope)

      renderGroup?.dispose()
      renderGroups.delete(renderScope)
      objectsPerScope.delete(renderScope)
      renderablesPerScope.delete(renderScope)
      sceneManager.render(true, true)
    },

    useObjectLifecycle_TEMPORARY_FIX: useObjectLifecycle,
  }

  return [api, api.cleanup]
}

export function useRenderAPI(renderScope: string, occludesSnapping = false, is2D = false): RenderAPI {
  const [api, cleanup] = useMemo(
    () => createRenderApi(renderScope, occludesSnapping, is2D),
    [renderScope, occludesSnapping, is2D],
  )
  useEffect(() => cleanup, [cleanup])
  return api
}
