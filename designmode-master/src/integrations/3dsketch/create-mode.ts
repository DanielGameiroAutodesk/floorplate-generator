import { explicitSignal } from "src/lib/signal"

export const [isCreateModeSignal, setIsCreateModeSignalValue] = explicitSignal<boolean>(true)
