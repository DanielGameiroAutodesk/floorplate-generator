import type { Urn } from "@spacemakerai/element-types"
import { elementState } from "src/core/elements/ElementState"
import type { Proposal } from "src/core/elements/Proposal"
import { PROJECT_ID, projectAccessSignal, projectSignal } from "src/core/project/project"
import { selectionArraySignal } from "src/core/selection/selectionState"
import { createRenderApi } from "src/integrations/render-api/RenderAPI"
import { createElementColorV2Api } from "src/integrations/elements-coloring/ElementColorAPI"
import { createHiddenElementsApi } from "src/integrations/extensions/EmbeddedViews/hidden-elements"
import { createRenderGlbApi } from "src/integrations/extensions/EmbeddedViews/RenderGLBAPI"
import { createColorbarApi } from "src/integrations/colorbar/ColorbarAPI"
import { actionApi } from "src/integrations/legacy-actions/ActionAPI"
import { DesignModeEvents } from "src/core/events/events"
import type { InternalPath } from "src/lib/element/path"
import type { ColorbarAdd, RenderedObject } from "./mappedTypes"

const [carbonRenderApi] = createRenderApi("carbon-analysis", false)
const [visibilityApi] = createHiddenElementsApi("carbon-analysis")
const [elementColorApi] = createElementColorV2Api("carbon-analysis")
const [glbApi] = createRenderGlbApi("carbon-analysis")
const [colorbarApi] = createColorbarApi("carbon-analysis")

export const sharedCarbonAPI = {
  get authcontext() {
    return PROJECT_ID
  },
  colorbarApi: {
    add: (params: ColorbarAdd) => colorbarApi.add(params),
    remove: () => colorbarApi.remove(),
    getRenderScope: () => colorbarApi.getRenderScope(),
    subscribe: (callback: (definition: { lowerIndex: number; upperIndex: number }) => void) => {
      return colorbarApi.onRangeFilterChange(callback)
    },
  },
  project: {
    get geoLocation() {
      return projectSignal.peek()?.geoLocation
    },
  },
  proposal: {
    get rootUrn() {
      return elementState.currentProposalSignal.peek().urn
    },
    updateElements: async (
      operations: {
        type: "replace"
        urn: Urn
        path: string
      }[],
    ) => {
      const actions = operations.map(({ urn, path }) => {
        return actionApi.update.oneByUrn(path, urn)
      })
      const flatActions = (await Promise.all(actions)).flat()
      actionApi.apply("embodied carbon analysis update elements", flatActions)
    },
    subscribe: (callback: (proposal: Proposal) => void) => {
      return elementState.currentProposalSignal.subscribe((proposal) => {
        callback(proposal)
      })
    },
    persistedProposalSubscribe: (callback: ({ rootUrn }: { rootUrn: Urn }) => void) => {
      return elementState.currentProposalSignal.subscribe((proposal) => {
        if (proposal.snapshot.isPersisted) {
          callback({ rootUrn: proposal.snapshot.rootUrn })
        }
      })
    },
  },
  selection: {
    getSelection: () => selectionArraySignal.peek(),
    subscribe: (callback: (selection: string[]) => void) => {
      return selectionArraySignal.subscribe((selection) => {
        callback(selection)
      })
    },
  },
  render: {
    upsert: (toAdd: RenderedObject) => carbonRenderApi.upsert(toAdd),
    remove: (id: string) => carbonRenderApi.remove(id),
    cleanup: () => carbonRenderApi.cleanup(),
  },
  visibilityApi: {
    setVisibility: (path: InternalPath, visible: boolean) => visibilityApi.setVisibility(path, visible),
    cleanup: () => visibilityApi.cleanup(),
  },
  elementColorApi: {
    setColors: (colors: Map<InternalPath, string>) => elementColorApi.setColors(colors),
    clearColors: (paths: InternalPath[]) => elementColorApi.clearColors(paths),
    clearAll: () => elementColorApi.clearAll(),
  },
  glbApi: {
    upsert: (renderedObject: { id: string; glb: ArrayBuffer }) => glbApi.upsert(renderedObject),
    remove: (id: string) => glbApi.remove(id),
    cleanup: () => glbApi.cleanup(),
  },
  designTool: {
    onEditStart: (callback: () => unknown) => {
      DesignModeEvents.addListener("tool.edit.start", callback)
      return () => {
        DesignModeEvents.removeListener("tool.edit.start", callback)
      }
    },
    onEditEnd: (callback: () => unknown) => {
      DesignModeEvents.addListener("tool.edit.end", callback)
      return () => {
        DesignModeEvents.removeListener("tool.edit.end", callback)
      }
    },
  },
  get canEdit() {
    return projectAccessSignal.peek()?.canEdit ?? false
  },
}
