import type { ReadonlySignal, Signal } from "@preact/signals"
import { computed, signal, useSignal } from "@preact/signals"
import { useCallback } from "preact/hooks"

export function useReadonlySignal<T>(value: T): ReadonlySignal<T> {
  const signal = useSignal<T>(value)
  signal.value = value
  return signal
}

export function useInitializerSignal<T>(initializer: () => T): Signal<T> {
  const signal = useSignal<T>(undefined as T)
  if (signal.peek() === undefined) {
    signal.value = initializer()
  }
  return signal
}

export function asReadonlySignal<T>(signal: Signal<T>): ReadonlySignal<T> {
  return signal
}

export const falseSignal: ReadonlySignal<false> = signal(false)
export const trueSignal: ReadonlySignal<true> = signal(true)

type SetterOrUpdater<T> = (valOrUpdater: ((currVal: T) => T) | T) => void

// Workaround for https://github.com/preactjs/signals/issues/585 and
// https://github.com/microsoft/TypeScript/pull/58296 to prevent
// a ReadonlySignal to be assignable to a Signal.
export type ReadonlySignalHack<T> = {
  readonly value: T
  peek(): T
  subscribe(fn: (value: T) => void): () => void
}

function runUpdater<T>(getCurrVal: () => T, updater: ((currVal: T) => T) | T): T {
  return typeof updater === "function" ? (updater as (currVal: T) => T)(getCurrVal()) : updater
}

/**
 * Create a signal and separate the read and write operations.
 *
 * This is useful when using signals as a way of exposing an API.
 * It makes the code more explicit and helps us understand where
 * state is being modified.
 *
 * @example
 * // Shows preferred naming pattern:
 * const [thingSignal, setThingSignalValue] = explicitSignal(...)
 */
export function explicitSignal<T>(value: T): [ReadonlySignalHack<T>, SetterOrUpdater<T>] {
  const item = signal(value)
  return [
    item,
    (updater) => {
      item.value = runUpdater(() => item.peek(), updater)
    },
  ]
}

/**
 * Create a SetterOrUpdated that can work on a computed value,
 * where there is a need to map back to apply to the underlying signal.
 */
export function createMappedSetterOrUpdater<T, R>(
  signal: ReadonlySignal<T>,
  setter: SetterOrUpdater<R>,
  mapper: (value: T) => R,
): SetterOrUpdater<T> {
  return (updater) => {
    setter(mapper(runUpdater(() => signal.peek(), updater)))
  }
}

/**
 * Create a signal and separate the read and write operations.
 * Include a reset method.
 *
 * This is useful when using signals as a way of exposing an API.
 * It makes the code more explicit and helps us understand where
 * state is being modified.
 *
 * @example
 * // Shows preferred naming pattern:
 * const [thingSignal, setThingSignalValue, resetThingSignal] = explicitSignalWithReset(...)
 */
export function explicitSignalWithReset<T>(
  value: T,
  resetHandler: (prev: T) => T = () => value,
): [ReadonlySignalHack<T>, SetterOrUpdater<T>, reset: () => void] {
  const item = signal(value)
  return [
    item,
    (updater) => {
      item.value = runUpdater(() => item.peek(), updater)
    },
    () => {
      item.value = resetHandler(item.peek())
    },
  ]
}

export interface SignalFamily<K, T> {
  defaultValue: T

  (key: K): Signal<T>
}

/**
 * Signal family.
 *
 * Inspired by Recoil's `atomFamily`.
 *
 * There is no eviction implemented, so use it wisely.
 */
export function signalFamily<K, T>(defaultValue: T): SignalFamily<K, T> {
  const registry = new Map<K, Signal<T>>()
  const factory: SignalFamily<K, T> = (key: K): Signal<T> => {
    let item = registry.get(key)
    if (!item) {
      item = signal(defaultValue)
      registry.set(key, item)
    }
    return item
  }
  factory.defaultValue = defaultValue
  return factory
}

/**
 * Computed signal family.
 *
 * Inspired by Recoil's `selectorFamily`.
 *
 * There is no eviction implemented, so use it wisely.
 */
export function computedFamily<K, T>(fn: (key: K) => T) {
  const registry = new Map<K, ReadonlySignal<T>>()
  return (key: K): ReadonlySignal<T> => {
    let item = registry.get(key)
    if (!item) {
      item = computed(() => fn(key))
      registry.set(key, item)
    }
    return item
  }
}

/**
 * Get a SetterOrUpdater for a signal.
 */
export function useSetSignal<T>(signal: Signal<T>): SetterOrUpdater<T> {
  return useCallback(
    (value) => {
      signal.value = runUpdater(() => signal.peek(), value)
    },
    [signal],
  )
}
