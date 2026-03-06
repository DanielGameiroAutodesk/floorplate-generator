import { atom, atomFamily, selector, useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { ROOT_KEY } from "src/lib/element/path"
import { useCallback, useEffect } from "preact/compat"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import { computed } from "@preact/signals"
import { createRecoilSelectorForSignal } from "src/lib/signal-recoil-adapters"
import { elementState } from "src/core/elements/ElementState"
import { proposalIdSignal } from "src/core/proposal"

export const areaSelectionOpenState = atom({
  key: "analysis-selection-mode/areaSelectionOpenState",
  default: false,
})

type ProposalID = string

export const activeSelectableAreasState = atomFamily<Set<InternalPath>, ProposalID>({
  key: "analysis-selection-mode/activeSelectableAreasState",
  default: selector({
    key: "analysis-selection-mode/activeSelectableAreasState/default",
    get: ({ get }) => {
      const selectableAreas = get(selectableAreasState)
      // select all areas (site and zones) by default
      return new Set<string>(selectableAreas.map((area) => area.path))
    },
    cachePolicy_UNSTABLE: { eviction: "most-recent" },
  }),
  effects: (proposalId) => [
    ({ setSelf, onSet, trigger }) => {
      // TODO: Consider if caching key should contain proposal ID instead of in cache value
      // this way we could support cache for multiple proposals at the same time, but at the cost
      // of using more session storage space as the key would be dynamic potentially filling up
      // if switching between many proposals.
      const cacheKey = "forma-selected-analysis-areas"
      const cacheVersion = "v1"

      const loadPersisted = () => {
        const savedValue = sessionStorage.getItem(cacheKey)
        if (savedValue) {
          const [storedCacheVersion, storedProposalId, areas] = JSON.parse(savedValue)
          if (storedCacheVersion !== cacheVersion) {
            throw new Error("Cache version mismatch")
          }
          if (storedProposalId === proposalId) {
            setSelf(new Set<string>(areas))
          }
        }
      }

      if (trigger === "get") {
        try {
          loadPersisted()
        } catch {
          console.log("Failed to load persisted selected analysis areas")
          sessionStorage.removeItem(cacheKey)
        }
      }

      onSet((newValue, _, isReset) => {
        isReset
          ? sessionStorage.removeItem(cacheKey)
          : sessionStorage.setItem(cacheKey, JSON.stringify([cacheVersion, proposalId, Array.from(newValue)]))
      })
    },
  ],
})

const selectableAnalysisTypes = [
  "area-metrics",
  "sky-component",
  "sun",
  "solar-panel",
  "noise",
  "microclimate",
  "wind",
] as const
export const entireSiteAnalysisTypes: AnalysisType[] = ["area-metrics", "sky-component", "sun", "solar-panel"]
export const circleAnalysisTypes: AnalysisType[] = ["microclimate", "wind", "noise"]
export enum DefaultArea {
  EntireSite = "entire-site",
  CustomCircle = "custom-circle",
}
export const defaultAreaSelectedState = atomFamily<DefaultArea | undefined, string>({
  key: "analysis-selection-mode/defaultAreaSelectedState",
  default: undefined,
})

export const useDefaultAnalysisType = () => {
  const activeAnalysis = activeAnalysisSignal.value
  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(proposalIdSignal.value))
  const [defaultAreaSelected, setDefaultAreaSelected] = useRecoilState(defaultAreaSelectedState(proposalIdSignal.value))

  // verify that the default selection is correct for each analysis
  useEffect(() => {
    // enable entire site or custom circle if no sites are selected
    if (activeSelectableAreas.size === 0 && !defaultAreaSelected && activeAnalysis) {
      if (entireSiteAnalysisTypes.includes(activeAnalysis)) {
        setDefaultAreaSelected(DefaultArea.EntireSite)
      } else if (circleAnalysisTypes.includes(activeAnalysis)) {
        setDefaultAreaSelected(DefaultArea.CustomCircle)
      }
    }

    // check default selection when analysisType changes
    if (defaultAreaSelected && activeAnalysis) {
      if (defaultAreaSelected === DefaultArea.EntireSite && !entireSiteAnalysisTypes.includes(activeAnalysis)) {
        setDefaultAreaSelected(DefaultArea.CustomCircle)
      } else if (defaultAreaSelected === DefaultArea.CustomCircle && !circleAnalysisTypes.includes(activeAnalysis)) {
        setDefaultAreaSelected(DefaultArea.EntireSite)
      }
    }
  }, [activeSelectableAreas.size, activeAnalysis, defaultAreaSelected, setDefaultAreaSelected])
}

export const useOverrideAnalysisSelection = () => {
  const setActiveSelectableAreas = useSetRecoilState(activeSelectableAreasState(proposalIdSignal.value))
  const setDefaultAreaSelected = useSetRecoilState(defaultAreaSelectedState(proposalIdSignal.value))

  const customCircle = useCallback(() => {
    setActiveSelectableAreas(new Set())
    setDefaultAreaSelected(DefaultArea.CustomCircle)
  }, [setActiveSelectableAreas, setDefaultAreaSelected])

  return { customCircle }
}

export const useSyncActiveSelectableAreas = () => {
  const selectableAreas = useRecoilValue(selectableAreasState)
  const [activeSelectableAreas, setActiveSelectableAreas] = useRecoilState(
    activeSelectableAreasState(proposalIdSignal.value),
  )

  // if an active selectable area is deleted, removed it from the active selectable area set
  useEffect(() => {
    const selectableAreaPaths = selectableAreas.map(({ path }) => path)
    Array.from(activeSelectableAreas).forEach((area) => {
      if (!selectableAreaPaths.includes(area)) {
        setActiveSelectableAreas((prev) => {
          prev.delete(area)
          return prev
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableAreas])
}

export type SelectableAnalysisType = (typeof selectableAnalysisTypes)[number]

export function isSelectableAnalysisType(t: any): t is SelectableAnalysisType {
  return !!t && selectableAnalysisTypes.includes(t)
}

export type SelectableArea = {
  title: string
  category?: string
  path: string
}

export const selectableAreasSignal = computed<SelectableArea[]>(() => {
  const snapshot = elementState.currentSnapshot.value

  const selectableAreas: SelectableArea[] = []

  function isSelectable(urn: Urn) {
    const container = snapshot.getElementContainerOrThrow(urn)
    const element = container.element
    if (!element.properties) return false
    if (!element.properties.category) return false
    if (!["site_limit", "zone"].includes(element.properties.category)) return false
    if (!element.representations) return false
    if (element.representations.volumeMesh) return false
    const feature = container.representations.footprint
    if (!feature) return false
    if (feature.geometry.type !== "Polygon") return false
    return feature.geometry.coordinates.length > 0
  }

  function traverse(child: Child, parentPath: string) {
    const element = snapshot.getElementContainerOrThrow(child.urn).element
    const path = `${parentPath}/${child.key}`
    if (isSelectable(child.urn)) {
      selectableAreas.push({
        path,
        category: element.properties?.category,
        title: child.name || generateChildName(child, element),
      })
    }

    if (element.children) {
      for (const child of element.children) {
        traverse(child, path)
      }
    }
  }

  const root = snapshot.rootNode.elementContainer.element
  for (const child of root.children || []) {
    traverse(child, ROOT_KEY)
  }

  return selectableAreas
})

const selectableAreasState = createRecoilSelectorForSignal(
  "analysis-selection-mode/selectableAreasState",
  selectableAreasSignal,
)

function generateChildName(child: { urn: string }, element: FormaElement) {
  const categoryText = element?.properties?.category
    ? {
        zone: "Zone",
        site_limit: "Site limit",
      }[element.properties.category]
    : "Object"

  const [, , , , elementId] = child.urn.split(":")
  return `${categoryText} ${elementId.slice(-3)}`
}

export interface Circle {
  x: number
  y: number
  radius: number
}

export const enclosingCircleOfAnalyzeSelectionState = atom<Circle | undefined>({
  key: "analysis-selection-mode/enclosingCircleOfAnalyzeSelectionState",
  default: undefined,
})
