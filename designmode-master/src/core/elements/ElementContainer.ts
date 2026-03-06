import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { type KnownRepresentations } from "./ElementRepresentations"
import { renderables3dController } from "./element-container-derived-data/renderable3d"
import { bboxController } from "./element-container-derived-data/bbox"
import { outlinesController } from "./element-container-derived-data/outlines"
import { snappingLinesController } from "./element-container-derived-data/snapping"
import { roofAndFloorTrianglesController } from "./element-container-derived-data/roofAndFloorTriangles"
import { selectablesController } from "./element-container-derived-data/selectables"
import { generateUnitsController } from "./element-container-derived-data/units"
import { Set_shallowEquals } from "src/lib/set"
import { captureException } from "@sentry/browser"
import { volumeMeshWithGeneratedBoundsTreeController } from "./element-container-derived-data/volumeMeshWithGeneratedBoundsTree"
import { reportObservedElementIssues } from "src/lib/element/issue-detection"
import {
  edgeOutlinesRenderables3dController,
  volumeMeshRenderables3dController,
} from "./element-container-derived-data/renderables3d_V3"
import type { Category } from "src/core/categories"
import { getMappedCategory } from "src/core/categories"
import type { CustomData } from "./custom-data"
import { FormaElementBox } from "src/lib/element/statebox"
import { DisposableStore } from "./derived-data/derived-data"
import { renderables2dController } from "./element-container-derived-data/renderable2d"
import { freezeFormaElement } from "src/lib/element/freeze"
// eslint-disable-next-line import/no-restricted-paths
import { areaStatsSurfacesController } from "src/integrations/area-stats/derived-element-container"
import { svgOutlinesController } from "./element-container-derived-data/svgOutlines"

function validateContainerChildrenOrThrow(
  elementChildren: readonly Child[],
  containerChildren: readonly ElementContainer[],
) {
  const elementChildrenUrns = new Set(elementChildren.map((c) => c.urn))
  const containerChildrenUrns = new Set(containerChildren.map((c) => c.element.urn))
  if (!Set_shallowEquals(elementChildrenUrns, containerChildrenUrns)) {
    const error = new Error("Mismatch between element children and provided list of container children")
    captureException(error, {
      tags: { owner: "squad-composition" },
    })
    throw error
  }
}

/**
 * This class contains everything related to individual elements, including:
 * - The actual `FormaElement`
 * - Resolved representations
 * - Snapping data, renderables, bounding boxes etc.
 */
export class ElementContainer {
  /**
   * The actual FormaElement
   *
   * Note: If the element is not persisted, the element should be considered to be a draft. Properties on the element
   * can change based on server response and this element should therefor not be cached
   */
  readonly element: FormaElement

  /**
   * Whether this element represents server state (i.e. persisted state) or not.
   *
   * **Note**: Non-persisted elements should never be cached, as the element might be populated with representation´
   * links or extra properties after persistence.
   */
  readonly isServerState: boolean

  /**
   * The immediate children of this element as ElementContainers. This list is guaranteed to have
   * containers for all the URNs found among the children on the FormaElement.
   */
  readonly children: readonly ElementContainer[]
  readonly childrenByUrn: ReadonlyMap<Urn, ElementContainer>

  readonly representations: Readonly<KnownRepresentations>

  #customData: CustomData | undefined

  /**
   * @param element The FormaElement the container contains
   * @param isServerState Whether the element represents server state (i.e. persisted state) or not
   * @param children Element containers for all children defined in the FormaElement (must match exactly)
   * @param representations The resolved representations for the element
   * @param customData Consumers of element containers can put custom data in an element container
   */
  private constructor(
    element: FormaElement,
    isServerState: boolean,
    children?: readonly ElementContainer[],
    representations?: KnownRepresentations,
    customData?: CustomData,
  ) {
    validateContainerChildrenOrThrow(element.children ?? [], children ?? [])
    this.element = freezeFormaElement(element)
    this.isServerState = isServerState
    this.children = Object.freeze(children ?? [])
    this.childrenByUrn = Object.freeze(
      new Map(this.children.map((childContainer) => [childContainer.element.urn, childContainer])),
    )
    this.representations = representations
      ? Object.freeze(representations)
      : {
          volumeMesh: undefined,
          terrainShape: undefined,
          footprint: undefined,
          terrainTexture: undefined,
          buildingFloors3DSketch_UNSTABLE: undefined,
        }
    this.#customData = customData

    reportObservedElementIssues(element, isServerState)
  }

  static fromServerElement(
    element: FormaElement,
    children?: readonly ElementContainer[],
    representations?: KnownRepresentations,
    customData?: CustomData,
  ) {
    return new ElementContainer(element, true, children, representations, customData)
  }

  static fromDraftElement(
    element: FormaElement,
    children?: readonly ElementContainer[],
    representations?: KnownRepresentations,
    customData?: CustomData,
  ) {
    return new ElementContainer(element, false, children, representations, customData)
  }

  readonly derivedDataDisposables = new DisposableStore()

  readonly renderable3d = renderables3dController(this)
  readonly renderable2d = renderables2dController(this)
  readonly bbox = bboxController(this)
  readonly outlines = outlinesController(this)
  readonly svgOutlines = svgOutlinesController(this)
  readonly snappingLines = snappingLinesController(this)
  readonly roofAndFloorTriangles = roofAndFloorTrianglesController(this)
  readonly selectables = selectablesController(this)
  readonly units = generateUnitsController(this)
  readonly volumeMeshWithBoundsTree = volumeMeshWithGeneratedBoundsTreeController(this)

  // New rendering
  readonly volumeMeshRenderables3d = volumeMeshRenderables3dController(this)
  readonly edgeOutlinesRenderables3d = edgeOutlinesRenderables3dController(this)

  readonly areaStatsSurfaces = areaStatsSurfacesController(this)

  get customData(): CustomData | undefined {
    return this.#customData
  }

  get mappedCategory(): Category {
    return getMappedCategory(this.element)
  }

  getRepresentationOrThrow<K extends keyof KnownRepresentations>(key: K): NonNullable<KnownRepresentations[K]> {
    const value = this.representations[key]
    if (value === undefined) {
      throw new Error(`Representation ${key} not found on element ${this.element.urn}`)
    }
    return value
  }

  toFormaElementBox() {
    return this.isServerState ? FormaElementBox.fromServer(this.element) : FormaElementBox.fromDraft(this.element)
  }
}
