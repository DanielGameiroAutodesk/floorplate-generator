import { explicitSignal } from "src/lib/signal"
import type { GetScenarioResponse } from "src/integrations/spaces/spaceClient/spaceClientv4"

export const [scenarioSignal, setScenarioSignalValue] = explicitSignal<GetScenarioResponse | undefined>(undefined)
