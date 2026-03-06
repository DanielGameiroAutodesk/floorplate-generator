import type { Signal } from "@preact/signals"
import { signal } from "@preact/signals"
import type { AtomEffect } from "recoil"

const storageEffect =
  <T>(key: string, storage: Storage): AtomEffect<T> =>
  ({ setSelf, onSet }) => {
    const savedValue = storage.getItem(key)
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue))
    }

    onSet((newValue, _, isReset) => {
      isReset ? storage.removeItem(key) : storage.setItem(key, JSON.stringify(newValue))
    })
  }

export const sessionStorageEffect =
  <T>(key: string): AtomEffect<T> =>
  (options) => {
    return storageEffect<T>(key, sessionStorage)(options)
  }

/** Used for string values, as the JSON.parse does not work well with strings */
const storageEffectString =
  <T extends string>(key: string, storage: Storage): AtomEffect<T> =>
  ({ setSelf, onSet }) => {
    const savedValue = storage.getItem(key)
    if (savedValue != null) {
      setSelf(savedValue as T)
    }

    onSet((newValue, _, isReset) => {
      isReset ? storage.removeItem(key) : storage.setItem(key, newValue)
    })
  }

export const sessionStorageEffectString =
  <T extends string>(key: string): AtomEffect<T> =>
  (options) => {
    return storageEffectString<T>(key, sessionStorage)(options)
  }

export function createStorageSignal<T>(
  storage: Storage,
  key: string,
  initialValue: T,
  serialize: (value: T) => string = (value) => JSON.stringify(value),
  deserialize: (value: string) => T = (value) => JSON.parse(value) as T,
): Signal<T> {
  const valueSignal = signal<T>(initialValue)

  const savedValue = storage.getItem(key)
  if (savedValue != null) {
    valueSignal.value = deserialize(savedValue)
  }

  let i = 0
  valueSignal.subscribe((newValue) => {
    // Skip initial value.
    if (i++ === 0) return

    if (newValue === initialValue) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, serialize(newValue))
    }
  })

  return valueSignal
}
