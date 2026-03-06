import { explicitSignal } from "src/lib/signal"

// Global errors are typically handled byErrorBoundary and should
// rarely be read or set manually from integrations.

export const [globalErrorSignal, setGlobalErrorSignalValue] = explicitSignal<Error | undefined>(undefined)
