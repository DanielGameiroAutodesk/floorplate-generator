import * as events from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import type { ScenarioUpdated } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import type { FormaElement } from "forma-elements"
import { type Dispatch, type StateUpdater, useEffect, useState } from "preact/hooks"
import { fetchScenarios } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/Proposal/utils"
import { captureException } from "@sentry/browser"
import { parseUrn } from "src/lib/element/urn"

type State = { status: "fetching" } | { status: "success"; data: FormaElement[] }
type SetScenarios = Dispatch<StateUpdater<State>>

export function useScenarios(projectId: string) {
  const [scenarios, setScenarios] = useState<State>({ status: "fetching" })

  useFetchScenarios(projectId, setScenarios)
  useSubscribeToEvents(setScenarios)

  return scenarios
}

function useFetchScenarios(projectId: string, setScenarios: SetScenarios) {
  useEffect(() => {
    async function call() {
      try {
        const scenarios = await fetchScenarios(projectId)
        setScenarios({ status: "success", data: scenarios })
      } catch (e) {
        captureException(e)
      }
    }

    void call()
  }, [projectId, setScenarios])
}

function useSubscribeToEvents(setScenarios: SetScenarios) {
  useEffect(() => {
    function onScenarioUpdated(e: CustomEvent<ScenarioUpdated>) {
      try {
        const { properties } = e.detail.scenario
        let newData: FormaElement[] = []
        if (e.detail.source !== events.source && properties?.tags?.includes("scenario")) {
          setScenarios((prevScenario) => {
            if (prevScenario.status === "success") {
              const existingScenario = prevScenario.data.find(
                (i) => parseUrn(i.urn).id === parseUrn(e.detail.scenario.urn).id,
              )

              const updatedData = prevScenario.data?.map((scenario) => {
                if (parseUrn(scenario.urn).id === parseUrn(e.detail.scenario.urn).id) {
                  const updatedScenario = {
                    ...scenario,
                    properties: {
                      ...scenario.properties,
                      name: properties?.name,
                      indicator: properties?.indicator,
                    },
                  }
                  return updatedScenario
                }
                return scenario
              })

              if (!existingScenario) {
                newData = [...updatedData, { ...e.detail.scenario }]
              } else {
                newData = [...updatedData]
              }
              return { status: "success", data: newData }
            }
            return prevScenario
          })
        }
      } catch (e) {
        captureException(e)
      }
    }

    window.addEventListener(events.SCENARIO_UPDATED, onScenarioUpdated as EventListener)
    return () => window.removeEventListener(events.SCENARIO_UPDATED, onScenarioUpdated as EventListener)
  }, [setScenarios])
}
