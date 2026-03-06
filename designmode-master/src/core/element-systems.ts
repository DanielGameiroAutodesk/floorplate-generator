import type { FormaElement, Urn, Volume25DCollection } from "@spacemakerai/element-types"
import type { NotPersistedContainers, SavingResult } from "./elements-saving/result"
import type { BufferGeometry, Matrix4 } from "three"
import type { BlobId } from "@spacemakerai/elements-client"
import type { Action } from "./legacy-actions"
import type { BuildingPieceMesh, VisualizationSettings } from "src/lib/visualizationSettings"
import type { Selectable, SelectionMode } from "./elements/element-container-derived-data/selectables"
import type { ElementContainer } from "./elements/ElementContainer"
import type { ElementSnapshot } from "./elements/ElementSnapshot"
import type { JsonRepresentations, Representation } from "forma-elements"
import type { Renderable3DGeometry } from "src/integrations/renderables/renderable"
// eslint-disable-next-line import/no-restricted-paths
import type { Surface } from "src/integrations/area-stats/surface"
import type { TerrainSamplerData } from "./terrain/terrain-types"

const elementSystems: Record<string, ElementSystem> = {}

export function registerElementSystem(systemName: string, system: ElementSystem): void {
  if (elementSystems[systemName]) {
    throw new Error(`Element system ${systemName} already registered`)
  }
  elementSystems[systemName] = system
}

export function getRegisteredElementSystem(systemName: string): ElementSystem | undefined {
  return elementSystems[systemName]
}

export function isElementSystemRegistered(systemName: string): boolean {
  return systemName in elementSystems
}

export function removeAllRegisteredSystems() {
  for (const system in elementSystems) {
    delete elementSystems[system]
  }
}

/**
 * The snapping line is a whole line that can be snapped to and is described by its endpoints.
 * Any segmenting of the line will be done on Design Mode / Connected Client side.
 */
export type SnappingLine =
  | { start: [number, number]; end: [number, number]; onTerrain: true }
  | { start: [number, number, number]; end: [number, number, number]; onTerrain: false }

export const NO_OVERRIDE = Symbol()

export type ElementSystem = {
  /**
   * This is called after loading an element using elements-client, and can be
   * used to transform the element before it is accessed.
   */
  elementsClientLoadTransform?: (element: FormaElement) => FormaElement

  /**
   * Override loading of elements in elements-client.
   */
  elementsClientElementsBypass?: (urns: Urn[]) => Promise<Map<Urn, FormaElement>>[]

  /**
   * Override loading of blobs in elements-client.
   */
  elementsClientBlobsBypass?: (blobIds: BlobId[]) => Promise<Map<BlobId, ArrayBuffer>>

  /** Customize how edge outline visuals are generated */
  generateEdgeOutlines?: (element: FormaElement) => Float32Array | undefined

  /** Customize the outlines which are used for SVG export */
  generateSvgOutlines?: (element: FormaElement) => Float32Array | undefined

  /** Customize how outlines and selection outlines are generated in 2d overlay scene*/
  generateSelectionOutlines2d?: (
    container: ElementContainer,
    globalMatrix: Matrix4,
    terrainSamplerData: TerrainSamplerData,
  ) => Float32Array | undefined

  /** Customize snapping lines for a given element */
  generateSnappingLines?: (element: FormaElement) => SnappingLine[] | undefined

  /** Customize how element parts are selectable in DesignMode */
  generateSelectables?: (
    container: ElementContainer,
  ) => { selectionMode: SelectionMode; selectables: Selectable[] } | undefined

  /** Customize how renderables are generated in DesignMode */
  generateVolumeMeshRenderables3d?: (container: ElementContainer) => Renderable3DGeometry[] | undefined

  /**
   * Provide 2D polygon representations for an element, by interpreting element-system specific data
   * (until we have a standardized representation to do this)
   */
  generateAreaStatsSurfaces?: (container: ElementContainer) => Surface[] | undefined

  /** Generate new meshes given vismode state in design mode  */
  applyVisualizationSettings_DEPRECATED?: (
    element: FormaElement,
    visualizationSettings: VisualizationSettings,
  ) => Map<Urn, BufferGeometry> | undefined

  /**
   * Generates units that should be visualized according to function / size
   * This function is paired with /src/lib/visualizationSettings.ts/getUnitColor
   * */
  generateUnitMeshes?(element: FormaElement): BuildingPieceMesh[] | typeof NO_OVERRIDE

  /** These can be used to override normal loading behaviour */
  customFetchVolumeMesh?: (element: FormaElement) => Promise<BufferGeometry | undefined>
  customFetchVolumeMeshes?: (element: FormaElement) => Promise<Map<Urn, BufferGeometry>>
  customFetchFootprint?: (element: FormaElement) => Representation<JsonRepresentations["footprint"]> | undefined
  customFetchTerrainShape?: (element: FormaElement) => Representation<JsonRepresentations["terrainShape"]> | undefined

  isSubSelectionElement?: (element: FormaElement) => boolean
  ignoreFailingLoads?: boolean

  canGenerateVolume25D?: (element: FormaElement) => boolean
  generateVolume25D?: (element: FormaElement, parent: FormaElement) => Volume25DCollection | undefined

  /** If not set, this will fail on save */
  saveHandler?: ElementSystemSaveHandler

  /** Override main mode actions */
  deletePaths?: (deletePaths: string[], snapshot: ElementSnapshot) => Action[]

  /**
   * Can be extended to have something like this:
   *
   *   capabilities: {                                            // Jørgen has some good thoughts on how copabilities
   *     canRename: (element: FormaElement) => boolean             // (like readonly/writable) can be communicated
   *     canColor: (element: FormaElement) => boolean              // through element properties instead
   *   }
   *   providers: {
   *     getHitbox: <T>(element: FormaElement, data: T) => boolean
   *   }
   *
   * */
}

type ElementSystemSaveHandler = (
  elementsToSave: NotPersistedContainers[],
  authContext: string,
) => Promise<SavingResult[]>
