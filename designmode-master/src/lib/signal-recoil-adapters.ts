import type { ReadonlySignal, Signal } from "@preact/signals"
import type { RecoilState, RecoilValueReadOnly, SerializableParam } from "recoil"
import { atom, atomFamily } from "recoil"
import type { SignalFamily } from "./signal"

/**
 * Expose a signal as a recoil selector.
 *
 * Intended to ease migrations to signals. Should not be needed long term.
 */
export function createRecoilSelectorForSignal<T>(atomKey: string, signal: ReadonlySignal<T>): RecoilValueReadOnly<T> {
  return atom<T>({
    key: atomKey,
    effects: [
      ({ setSelf }) => {
        signal.subscribe((value) => {
          // Pass as a callback to support Promise values.
          setSelf(() => value)
        })
      },
    ],
    // Avoid freezing objects that breaks threejs objects.
    dangerouslyAllowMutability: true,
  })
}

/**
 * Expose a signal family as a recoil selector family.
 *
 * Intended to ease migrations to signals. Should not be needed long term.
 */
export function createRecoilSelectorFamilyForSignal<K extends SerializableParam, T>(
  atomKey: string,
  computedFamily: (key: K) => ReadonlySignal<T>,
): (param: K) => RecoilValueReadOnly<T> {
  return atomFamily<T, K>({
    key: atomKey,
    effects: (key) => {
      const signal = computedFamily(key)
      return [
        ({ setSelf }) => {
          signal.subscribe((value) => {
            // Pass as a callback to support Promise values.
            setSelf(() => value)
          })
        },
      ]
    },
    // Avoid freezing objects that breaks threejs objects.
    dangerouslyAllowMutability: true,
  })
}

/**
 * Expose a signal familiy as a two-way binding recoil atom family.
 *
 * Reading and writing can be done to both the atom and the signal.
 *
 * Intended to ease migrations to signals. Should not be needed long term.
 */
export function createBidirectionalRecoilAtomFamilyForSignal<K extends SerializableParam, T>(
  atomKey: string,
  signalFamily: SignalFamily<K, T>,
): (param: K) => RecoilState<T> {
  return atomFamily<T, K>({
    key: atomKey,
    default: () => signalFamily.defaultValue,
    effects: (param) => {
      const signal = signalFamily(param)
      return [
        ({ setSelf, onSet }) => {
          signal.subscribe((value) => {
            // Pass as a callback to support Promise values.
            setSelf(() => value)
          })
          onSet((value) => {
            signal.value = value
          })
        },
      ]
    },
    // Avoid freezing objects that breaks threejs objects.
    dangerouslyAllowMutability: true,
  })
}

/**
 * Expose a signal as a two-way binding recoil atom.
 *
 * Reading and writing can be done to both the atom and the signal.
 *
 * The atom will be passed the default value of the signal value when this method is called.
 * This is relevant to Recoil reset actions.
 *
 * Intended to ease migrations to signals. Should not be needed long term.
 */
export function createBidirectionalRecoilAtomForSignal<T>(atomKey: string, signal: Signal<T>): RecoilState<T> {
  return atom<T>({
    key: atomKey,
    default: signal.peek(),
    effects: [
      ({ setSelf, onSet }) => {
        signal.subscribe((value) => {
          // Pass as a callback to support Promise values.
          setSelf(() => value)
        })
        onSet((value) => {
          signal.value = value
        })
      },
    ],
    // Avoid freezing objects that breaks threejs objects.
    dangerouslyAllowMutability: true,
  })
}
