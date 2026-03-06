import { useEffect, useMemo } from "preact/hooks"
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three"
import sceneManager from "src/core/three/sceneManager"

export type Position = { x: number; y: number; z: number }
export type Scale = { x: number; y: number }

/**
 * API for rendering canvases as texture on the ground
 */
export interface GroundTextureAPIInterface {
  /**
   * Named scope for a specific use of the API
   */
  renderScope: string

  /**
   * Add a canvas and render it as texture on the ground
   *
   * @param name Unique name for the canvas object
   * @param canvas The canvas to render
   * @param position Position of the canvas object relative to refPoint
   * @param scale Scale to apply to the canvas object in x and y directions
   */
  add: (name: string, canvas: HTMLCanvasElement, position: Position, scale?: Scale) => void

  /**
   * Replace the texture data of an existing canvas object
   *
   * Does nothing if the canvas object does not exist
   *
   * @param name Name of the canvas object to update
   * @param canvas Canvas containing the new texture data
   */
  updateTextureData: (name: string, canvas: HTMLCanvasElement) => void

  /**
   * Update the position of an existing canvas object
   *
   * Does nothing if the canvas object does not exist
   *
   * @param name Name of the canvas object to update
   * @param position New position of the canvas object relative to refPoint
   *
   */
  updatePosition: (name: string, position: Position) => void

  /**
   * Remove a canvas object from the scene
   *
   * Does nothing if the canvas object does not exist
   *
   * @param name Name of the canvas object to remove
   */
  remove: (name: string) => void

  /**
   * Removes all rendered ground textures and frees memory used by this renderScope
   */
  cleanup: () => void
}

const groupsPerScope: Map<string, Group> = new Map()
const objectsPerScope: Map<string, Map<string, Mesh<PlaneGeometry, MeshBasicMaterial>>> = new Map()

class CanvasTextureWithAlpha extends CanvasTexture {
  premultiplyAlpha = true
}

export function createGroundTextureApi(renderScope: string): [GroundTextureAPIInterface, cleanup: () => void] {
  function add(name: string, canvas: HTMLCanvasElement, position: Position, scale: Scale = { x: 1, y: 1 }) {
    if (!groupsPerScope.has(renderScope)) {
      let group = new Group()
      sceneManager.overlay.scene.add(group)
      groupsPerScope.set(renderScope, group)
    }

    if (!objectsPerScope.has(renderScope)) {
      objectsPerScope.set(renderScope, new Map<string, Mesh<PlaneGeometry, MeshBasicMaterial>>())
    }

    const renderGroup = groupsPerScope.get(renderScope)!
    const objects = objectsPerScope.get(renderScope)!

    const geometry = new PlaneGeometry(canvas.width * scale.x, canvas.height * scale.y, 1, 1)
    const texture = new CanvasTextureWithAlpha(canvas)
    const material = new MeshBasicMaterial({ map: texture, transparent: true })
    material.map!.colorSpace = SRGBColorSpace
    const mesh = new Mesh(geometry, material)
    mesh.position.set(position.x, position.y, position.z)

    objects.set(name, mesh)
    renderGroup.add(mesh)
    sceneManager.render(false, true)
  }

  function updateTextureData(name: string, canvas: HTMLCanvasElement) {
    const renderGroup = groupsPerScope.get(renderScope)
    const objects = objectsPerScope.get(renderScope)
    if (!renderGroup || !objects) return

    const currentObject = objects.get(name)
    if (!currentObject) return
    const texture = new CanvasTextureWithAlpha(canvas)
    currentObject.material.map = texture
    currentObject.material.map.colorSpace = SRGBColorSpace
    currentObject.material.map.needsUpdate = true
    sceneManager.render(false, true)
  }

  function updatePosition(name: string, position: Position) {
    const renderGroup = groupsPerScope.get(renderScope)
    const objects = objectsPerScope.get(renderScope)
    if (!renderGroup || !objects) return

    const currentObject = objects.get(name)
    if (!currentObject) return

    currentObject.position.set(position.x, position.y, position.z)
    sceneManager.render(false, true)
  }

  function remove(name: string) {
    const renderGroup = groupsPerScope.get(renderScope)
    const objects = objectsPerScope.get(renderScope)
    if (!renderGroup || !objects) return

    const currentObject = objects.get(name)
    if (!currentObject) return

    objects.delete(name)
    currentObject.material.map!.dispose()
    currentObject.geometry.dispose()
    renderGroup.remove(currentObject)
    sceneManager.render(true, true)
  }

  function cleanup() {
    const renderGroup = groupsPerScope.get(renderScope)
    const objects = objectsPerScope.get(renderScope)
    if (!renderGroup || !objects) return

    objects.forEach((_, key) => {
      remove(key)
    })

    groupsPerScope.delete(renderScope)
    objectsPerScope.delete(renderScope)
    sceneManager.render(true, true)
  }

  const api: GroundTextureAPIInterface = {
    renderScope,
    add,
    updateTextureData,
    updatePosition,
    remove,
    cleanup,
  }

  return [api, api.cleanup]
}

export function useGroundTextureAPI(renderScope: string): GroundTextureAPIInterface {
  const [api, cleanup] = useMemo(() => createGroundTextureApi(renderScope), [renderScope])
  useEffect(() => cleanup, [cleanup])
  return api
}
