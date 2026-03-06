import { useCallback, useState } from "preact/hooks"
import type { FormaElement } from "@spacemakerai/element-types"
import { createUrn, newId, newRevision, parseUrn, replaceRevision } from "src/lib/element/urn"
import { PROJECT_ID } from "./project/project"
import { request } from "src/lib/request"
import { proposalIdSignal } from "./proposal"
import { AnalyticsLegacy, analyticsAndBreadcrumbsForActions } from "./analytics"
import { captureException } from "@sentry/browser"
import { downloadAllElementData } from "./elements-loading/downloadAllElementData"
import { resetSelectionSetSignal } from "./selection/selectionState"
import { useEffect } from "react"
import { getElementsClient } from "./elements-loading/loading"
import { elementState } from "./elements/ElementState"
import { ElementContainer } from "./elements/ElementContainer"
import { elementContainerTreeFromObjects } from "./elements/elementContainersFromObjects"
import { validateIsFormaElement } from "src/lib/elementFormatUtils"
import { dispatchScenarioUpdated } from "./proposal-window-events/dispatchers"
import { SCENARIO_UPDATED_EVENT } from "./proposal-window-events/constants"
import { isDefined } from "src/lib/array"
import { getTranslator } from "src/i18n"

export default function useBaseUtils() {
  const [bases, setBases] = useState<FormaElement[]>([])
  const [isFetching, setIsFetching] = useState(true)

  const currentBase = elementState.currentBaseSignal.value.element
  const proposalId = proposalIdSignal.value

  const isCurrentBase = (base: FormaElement): boolean => {
    return !!currentBase && parseUrn(currentBase.urn).id == parseUrn(base.urn).id
  }

  const refreshBases = useCallback(() => {
    setIsFetching(true)
    void fetchBaseLayers()
      .then((bases) => {
        setBases(bases)
        sessionStorage.setItem("forma-designmode-prev-num-bases", `${bases.length}`)
        setIsFetching(false)
      })
      .catch((e) => {
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.base.errors.fetchFailed),
          status: "error",
        })
        captureException(e)
      })
  }, [])

  useEffect(() => {
    window.addEventListener(SCENARIO_UPDATED_EVENT, refreshBases)
    return () => window.removeEventListener(SCENARIO_UPDATED_EVENT, refreshBases)
  }, [refreshBases])

  useEffect(() => {
    refreshBases()
  }, [refreshBases])

  const addBase = useCallback(() => {
    const newBase: FormaElement = {
      urn: createUrn("group", PROJECT_ID, newId(), newRevision()),
      properties: {
        name: "Untitled base",
        category: "group",
        component: true,
        tags: ["scenario", "base"],
        indicator: nextIndicator(bases),
      },
    }

    const baseContainer = ElementContainer.fromDraftElement(newBase)
    // Don't track this with new tracking schema.
    analyticsAndBreadcrumbsForActions("Create new base")
    elementState.updateBase(baseContainer)

    resetSelectionSetSignal()
  }, [bases])

  const duplicateBase = useCallback(
    async (base: FormaElement) => {
      try {
        const { element: group } = await getElementsClient().getElementAutoBatched(base.urn)
        const baseLayers = await fetchBaseLayers()
        const duplicatedBase = await request(`/api/group/elements?authcontext=${PROJECT_ID}`, {
          method: "POST",
          body: JSON.stringify({
            ...group,
            name: group.properties!.name + " Copy",
            properties: {
              ...group.properties,
              indicator: nextIndicator(baseLayers),
            },
          }),
        })
          .then((res) => res.json())
          .then(validateIsFormaElement)

        //TODO: Move to handler, do not track inside an API
        // Don't track this with new tracking schema.
        AnalyticsLegacy.track("Base - Duplicate", { proposalId })
        return duplicatedBase
      } catch (e) {
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.base.errors.duplicateFailed),
          status: "warning",
        })
        captureException(e)
      }
    },
    [proposalId],
  )

  const deleteBase = useCallback(
    async (base: FormaElement) => {
      const { id, revision } = parseUrn(base.urn)
      try {
        const url = `/api/group/elements/${id}/revisions/${revision}?authcontext=${PROJECT_ID}`
        await request(url, {
          method: "PUT",
          body: JSON.stringify({ properties: { tags: [] } }),
        }).then((res) => res.json())
        setBases(bases.filter((b) => parseUrn(b.urn).id !== parseUrn(base.urn).id))
        //TODO: Move to handler, do not track inside an API
        // Don't track this with new tracking schema.
        AnalyticsLegacy.track("Base - Delete", { proposalId })
      } catch (e) {
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.base.errors.deleteFailed),
          status: "warning",
        })
        captureException(e)
      }
    },
    [bases, proposalId],
  )

  const swapBase = useCallback(async ({ urn }: FormaElement) => {
    try {
      const { elements, representations } = await downloadAllElementData(new Set([urn]))

      const newBaseRootContainer = elementContainerTreeFromObjects(
        urn,
        elements,
        representations,
        elementState.currentSnapshot.peek().elements,
      )
      // Don't track this with new tracking schema.
      analyticsAndBreadcrumbsForActions("Switch base")
      elementState.updateBase(newBaseRootContainer)

      resetSelectionSetSignal()
    } catch (e) {
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.base.errors.switchFailed),
        status: "warning",
      })
      captureException(e)
    }
  }, [])

  const updateBaseName = useCallback(
    (base: FormaElement, newName: string) => {
      try {
        const updatedBaseLayer: FormaElement = {
          ...base,
          urn: replaceRevision(base.urn),
          properties: {
            ...base?.properties,
            name: newName,
          },
        }

        const oldBaseContainer = elementState.currentBaseSignal.peek().container
        const baseContainer = ElementContainer.fromDraftElement(updatedBaseLayer, oldBaseContainer.children)
        // Don't track this with new tracking schema.
        analyticsAndBreadcrumbsForActions("Rename base")
        elementState.updateBase(baseContainer)

        //TODO: Move to handler, do not track inside an API
        // Don't track this with new tracking schema.
        AnalyticsLegacy.track("Base - Rename", { proposalId })
        dispatchScenarioUpdated(updatedBaseLayer)
      } catch (e) {
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.base.errors.renameFailed),
          status: "warning",
        })
        captureException(e)
      }
    },
    [proposalId],
  )

  const updateBaseIndicator = useCallback((base: FormaElement, newIndicator: string) => {
    try {
      const updatedBaseLayer = {
        ...base,
        urn: replaceRevision(base.urn),
        properties: {
          ...base.properties,
          indicator: newIndicator,
        },
      }

      const oldBaseContainer = elementState.currentBaseSignal.peek().container
      const baseContainer = ElementContainer.fromDraftElement(updatedBaseLayer, oldBaseContainer.children)
      // Don't track this with new tracking schema.
      analyticsAndBreadcrumbsForActions("Rename indicator")
      elementState.updateBase(baseContainer)

      dispatchScenarioUpdated(updatedBaseLayer)
    } catch (e) {
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.base.errors.renameIndicatorFailed),
        status: "warning",
      })
      captureException(e)
    }
  }, [])

  return {
    addBase,
    duplicateBase,
    deleteBase,
    swapBase,
    bases,
    updateBaseName,
    updateBaseIndicator,
    isFetching,
    isCurrentBase,
  }
}

const fetchBaseLayers = async (): Promise<FormaElement[]> => {
  return await request(`/api/group/elements/components?tag=scenario&authcontext=${PROJECT_ID}`).then(
    (res): Promise<FormaElement[]> => res.json(),
  )
}

export function nextIndicator(scenarios: FormaElement[] | undefined) {
  if (!scenarios) {
    return "A"
  }
  const indicators = scenarios
    .map((scenario) => scenario?.properties?.indicator as string | undefined)
    .filter(isDefined)

  if (indicators.length === 0) {
    return "A"
  }

  const longestIndicator = Math.max(...indicators.map((indicator) => indicator.length))

  const longIndicators: string[] = indicators.filter((indicator) => indicator.length === longestIndicator)
  longIndicators.sort()

  const lastIndicator = longIndicators[longIndicators.length - 1]

  if (longestIndicator === 1) {
    if (lastIndicator == "Z") {
      return "AA"
    } else {
      return String.fromCodePoint(lastIndicator.codePointAt(0)! + 1)
    }
  } else if (longestIndicator === 2) {
    if (lastIndicator == "ZZ") {
      return "??"
    } else {
      return (
        String.fromCodePoint(lastIndicator.codePointAt(0)!) + String.fromCodePoint(lastIndicator.codePointAt(1)! + 1)
      )
    }
  } else {
    return "??"
  }
}
