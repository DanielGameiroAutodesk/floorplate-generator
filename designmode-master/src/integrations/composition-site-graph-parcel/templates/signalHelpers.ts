import type { ReadonlySignal, Signal } from "@preact/signals"
import { computed } from "@preact/signals"

export function toReadonlySignal<T>(signal: Signal<T>): ReadonlySignal<T> {
  return computed(() => signal.value)
}
