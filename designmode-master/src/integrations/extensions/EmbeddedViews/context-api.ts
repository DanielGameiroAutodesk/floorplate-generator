import { cameraApi } from "src/integrations/camera/CameraAPI"
import { createRenderApi } from "src/integrations/render-api/RenderAPI"
import { actionApi, fromFormaElementBoxMap } from "src/integrations/legacy-actions/ActionAPI"
import { createRenderGlbApi } from "./RenderGLBAPI"
import { portableDesignToolApi } from "./PortableDesignToolAPI"
import { createGroundTextureApi } from "src/integrations/ground-texture/GroundTextureAPI"
import { createElementColorV2Api } from "src/integrations/elements-coloring/ElementColorAPI"
import { createRenderGeojsonApi } from "./RenderGeoJsonAPI"
import { createColorbarApi } from "src/integrations/colorbar/ColorbarAPI"
import { housingApi } from "src/integrations/composition-housing/api"
import { analysisSelectionApiSignal } from "src/integrations/analysis-selection/AnalysisSelectionAPI"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import type { ReadonlySignal } from "@preact/signals"
import { computed } from "@preact/signals"
import { changeProposal, changeProposalPageReload } from "src/core/proposal-refresh"
import moize from "moize"
import type { EmbeddedViewHostContext as Context } from "./generated-types"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import type { InternalPath } from "src/lib/element/path"
import { projectGeoLocationSignal } from "src/core/project/project"
import { SunApi } from "src/integrations/sun/api"
import { createHiddenElementsApi } from "./hidden-elements"
import type { Child, Urn } from "forma-elements"
import type { Matrix4 } from "three"
import type { Feature } from "geojson"
import { projectSignal } from "src/core/project/project"
import { createDesignEventsApi } from "./event-adapters"
import { resetSelectionSetSignal, selectionArraySignal } from "src/core/selection/selectionState"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { newChildKey } from "src/lib/element/urn"
import { createRenderElementApi } from "./RenderElementApi"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { dispatchProposalsUpdatedEvent } from "src/core/proposal-window-events/dispatchers"

// Lazy to workaround a circular dependency issue visible in tests.
const getMappedActionApi = moize((): Context["actionApi"] => ({
  add: {
    oneByUrn: actionApi.add.subTreeByRootUrn,
    multipleByUrn: async (
      items: {
        urn: Urn
        parentPath?: string
        child?: Omit<Child, "urn">
      }[],
    ) => {
      const { elements, representations } = await downloadAllElementData(new Set(items.map((item) => item.urn)))
      return items.flatMap((item) =>
        actionApi.add.subTree_UNSTABLE(item.urn, ...fromFormaElementBoxMap(elements), representations, {
          parentPath: item.parentPath || "root",
          child: { key: newChildKey(), ...item.child },
        }),
      )
    },
  },
  update: {
    oneByUrn: actionApi.update.oneByUrn,
  },
  delete: {
    one: actionApi.delete.one,
  },
  utils: {
    // Workaround to avoid having to declare the full type of Action
    // in forma-embedded-view-host.
    getPathOfAction: (action: any) => actionApi.utils.getPathOfAction(action),
    generateNewChildKey: actionApi.utils.generateNewChildKey,
  },
  apply: actionApi.apply,
}))

const mappedAnalysisSelectionApiSignal = computed((): Context["analysisSelectionApi"] => {
  const analysisSelectionApi = analysisSelectionApiSignal.value
  return {
    getTopLevelElementsInsidePolygons: analysisSelectionApi.getTopLevelElementsInsidePolygons,
  }
})

const mappedCameraApi: Context["cameraApi"] = {
  moveCamera: cameraApi.moveCamera,
  switchPerspective: cameraApi.switchPerspective,
  captureScreen: cameraApi.EXPERIMENTAL_captureScreen,
  getCameraSettings: cameraApi.getCameraSettings,
  getCurrentCameraState: cameraApi.getCurrentCameraState,
  cameraEvents: cameraApi.cameraEvents,
}

const mappedDesignEventsApi = createDesignEventsApi()

const mappedDesignToolApi: Context["designToolApi"] = {
  getPoint: portableDesignToolApi.getPoint,
  getPolygon: portableDesignToolApi.getPolygon,
  getExtrudedPolygon: portableDesignToolApi.getExtrudedPolygon,
  getLine: portableDesignToolApi.getLine,
}

function mappedGetElement(urn: Urn) {
  return elementState.currentSnapshot.peek().getFormaElementOrThrow(urn)
}

function mappedGetElementByPath(path: InternalPath) {
  return elementState.currentSnapshot.peek().getNode(path)?.element
}

function mappedGetVolumeMesh(urn: Urn) {
  return getVolumeMeshWithTerrainFallback(elementState.currentProposalSignal.peek(), urn)
}

type FootprintDeprecated = { type: "LineString" | "Polygon"; coordinates: number[][] }

// TODO: Rewrite this to handle e.g. holes in a polygon.
function getFootprintDeprecated(snapshot: ElementSnapshot, urn: Urn): FootprintDeprecated | undefined {
  const container = snapshot.getElementContainer(urn)
  const feature = container?.representations.footprint

  if (feature?.geometry.type === "LineString") {
    return { type: "LineString", coordinates: feature.geometry.coordinates }
  } else if (feature?.geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: feature.geometry.coordinates[0] }
  }
}

function mappedGetFootprintDeprecated(urn: Urn) {
  return getFootprintDeprecated(elementState.currentSnapshot.peek(), urn)
}

function mappedGetUrnForPath(path: InternalPath): Urn | undefined {
  return elementState.currentSnapshot.peek().getNode(path)?.urn
}

function mappedGetWorldTransform(path: InternalPath): Matrix4 {
  return elementState.currentSnapshot.peek().getNodeOrThrow(path).globalMatrix
}

function mappedGetGeojson(urn: Urn): Feature | undefined {
  return elementState.currentSnapshot.peek().getElementContainer(urn)?.representations.footprint
}

const mappedElementStateApiSignal = computed((): Context["elementStateApi"] => {
  const proposal = elementState.currentProposalSignal.value
  return {
    rootUrn: proposal.urn,
    proposalId: proposal.id,
    // Keep stable references for these methods. They will always access latest state.
    getElement: mappedGetElement,
    getElementByPath: mappedGetElementByPath,
    getVolumeMesh: mappedGetVolumeMesh,
    // TODO: The current footprint retrieval here is a slice of a footprint and not the full data for an element.
    getFootprint: mappedGetFootprintDeprecated,
    getUrnForPath: mappedGetUrnForPath,
    getWorldTransform: mappedGetWorldTransform,
    getGeojson: mappedGetGeojson,
  }
})

/**
 * Since templates are loaded some time after the page is loaded (specifically, 3 seconds) and we don't know when this function will be called in the lifecycle, we need to wait for them to be loaded.
 */
async function listTemplates(): ReturnType<NonNullable<Context["housingApi"]>["listTemplates"]> {
  return new Promise((resolve) => {
    const unsubscribe = housingApi.templatesSignal.subscribe((value) => {
      if (value) {
        unsubscribe()
        resolve(value)
      }
    })
  })
}

const mappedHousingApi: Context["housingApi"] = {
  createHousingLine: housingApi.createHousingLine,
  listTemplates,
}

const mappedProjectApiSignal = computed((): Context["projectApi"] => {
  return {
    currentProject: projectSignal.value,
  }
})

const mappedProjectGeoLocationApiSignal = computed((): Context["projectGeoLocationApi"] => {
  return {
    // TODO(scenario): The projString is currently empty for scenarios.
    projectGeoLocation: projectGeoLocationSignal.value,
  }
})

function refreshProposal() {
  // We can safely dispatch an empty array, because the main list of proposals will be refetched on event anyway,
  // while the passed array will be *merged* with the existing proposals in the state
  dispatchProposalsUpdatedEvent([])
}

const mappedSelectionApiSignal = computed((): Context["selectionApi"] => {
  return {
    selection: selectionArraySignal.value,
    resetSelection: resetSelectionSetSignal,
  }
})

const mappedSunApiSignal = computed((): Context["sunApi"] => {
  const sunDate = SunApi.sunDateSignal.value
  return {
    get: () => sunDate,
    set: SunApi.setSunDateSignalValue,
  }
})

const mappedTerrainApiSignal = computed((): Context["terrainApi"] => {
  const terrain = terrainSignal.value
  return {
    elevationAt: terrain.elevationAt,
    getBbox: { min: terrain.terrainSamplerData.bbox.min, max: terrain.terrainSamplerData.bbox.max },
  }
})

const mappedTerrainPadsApiSignal = computed((): Context["terrainPadsApi"] => {
  return {
    applyPads: terrainApi.applyTerrainOperationsWithoutTracking,
    addPads: terrainApi.appendTerrainOperationsWithoutTracking,
    getPads: terrainApi.getCurrentTerrainOperations,
  }
})

const mappedPersistenceApi: Context["persistenceApi"] = {
  getIsUrnPersisted: (urn: Urn) => {
    const element = elementState.currentSnapshot.peek().getElementContainer(urn)
    return element != null && element.isServerState
  },
}

export function createEmbeddedViewContextSignal(renderScope: string): [ReadonlySignal<Context>, cleanup: () => void] {
  const cleanupFns: (() => void)[] = []
  const cleanup = () => {
    cleanupFns.forEach((fn) => fn())
  }

  const [colorbarApi, colorbarApiCleanup] = createColorbarApi(renderScope)
  cleanupFns.push(() => colorbarApiCleanup())
  const mappedColorbarApi: Context["colorbarApi"] = {
    add: colorbarApi.add,
    remove: colorbarApi.remove,
    getRenderScope: colorbarApi.getRenderScope,
  }

  const [groundTextureApi, groundTextureApiCleanup] = createGroundTextureApi(renderScope)
  cleanupFns.push(() => groundTextureApiCleanup())
  const mappedGroundTextureApi: Context["groundTextureApi"] = {
    add: groundTextureApi.add,
    updateTextureData: groundTextureApi.updateTextureData,
    updatePosition: groundTextureApi.updatePosition,
    remove: groundTextureApi.remove,
  }

  const [elementColorApi, elementColorApiCleanup] = createElementColorV2Api(renderScope)
  cleanupFns.push(() => elementColorApiCleanup())
  const mappedElementColorApi: Context["elementColorApi"] = {
    setColors: elementColorApi.setColors,
    clearColors: elementColorApi.clearColors,
    clearAll: elementColorApi.clearAll,
  }

  const [hiddenElementsApi, hiddenElementsApiCleanup] = createHiddenElementsApi(renderScope)
  cleanupFns.push(() => hiddenElementsApiCleanup())
  const mappedHiddenElementsApi: Context["hiddenElementsApi"] = {
    setVisibility: hiddenElementsApi.setVisibility,
    setVisibilityBatch: hiddenElementsApi.setVisibilityBatch,
    cleanup: hiddenElementsApi.cleanup,
  }

  const [renderElementsApi, renderElementsApiCleanup] = createRenderElementApi(renderScope)
  cleanupFns.push(() => renderElementsApiCleanup())
  const mappedRenderElementsApi: Context["renderElementApi"] = {
    upsert: renderElementsApi.upsert,
    remove: renderElementsApi.remove,
    cleanup: renderElementsApi.cleanup,
  }

  const [renderApi, renderApiCleanup] = createRenderApi(renderScope)
  cleanupFns.push(() => renderApiCleanup())
  const mappedRenderApi: Context["renderApi"] = {
    upsert: renderApi.upsert,
    remove: renderApi.remove,
    cleanup: renderApi.cleanup,
  }

  const [renderGeoJsonApi, renderGeoJsonApiCleanup] = createRenderGeojsonApi(renderScope)
  cleanupFns.push(() => renderGeoJsonApiCleanup())
  const mappedRenderGeojsonApi: Context["renderGeojsonApi"] = {
    upsert: renderGeoJsonApi.upsert,
    remove: renderGeoJsonApi.remove,
    cleanup: renderGeoJsonApi.cleanup,
  }

  const [renderGlbApi, renderGlbApiCleanup] = createRenderGlbApi(renderScope)
  cleanupFns.push(() => renderGlbApiCleanup())
  const mappedRenderGlbApi: Context["renderGlbApi"] = {
    upsert: renderGlbApi.upsert,
    remove: renderGlbApi.remove,
    cleanup: renderGlbApi.cleanup,
  }

  const mappedProposalApi: Context["proposalApi"] = {
    changeProposal,
    changeProposalPageReload,
    refreshProposal,
  }

  // Keep in mind that computed is re-run on signal updates, so keep as much as
  // feasible above this or in separate signals to reuse values.
  const contextSignal = computed((): Context => {
    // Notice that all values here represents a "mapped value",
    // which is a copy of the underlying API by picking only the
    // values that are intended to be exposed to the embedded view context.
    //
    // The intention is important - it prevents additional APIs to leak into
    // the embedded view than what is defined in the types here.
    return {
      actionApi: getMappedActionApi(),
      analysisSelectionApi: mappedAnalysisSelectionApiSignal.value,
      cameraApi: mappedCameraApi,
      colorbarApi: mappedColorbarApi,
      designEventsApi: mappedDesignEventsApi,
      designToolApi: mappedDesignToolApi,
      elementColorApi: mappedElementColorApi,
      elementStateApi: mappedElementStateApiSignal.value,
      groundTextureApi: mappedGroundTextureApi,
      hiddenElementsApi: mappedHiddenElementsApi,
      housingApi: mappedHousingApi,
      persistenceApi: mappedPersistenceApi,
      projectApi: mappedProjectApiSignal.value,
      projectGeoLocationApi: mappedProjectGeoLocationApiSignal.value,
      proposalApi: mappedProposalApi,
      renderApi: mappedRenderApi,
      renderGeojsonApi: mappedRenderGeojsonApi,
      renderGlbApi: mappedRenderGlbApi,
      renderElementApi: mappedRenderElementsApi,
      selectionApi: mappedSelectionApiSignal.value,
      sunApi: mappedSunApiSignal.value,
      terrainApi: mappedTerrainApiSignal.value,
      terrainPadsApi: mappedTerrainPadsApiSignal.value,
    }
  })

  return [contextSignal, cleanup]
}
