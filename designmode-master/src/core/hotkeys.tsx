import type { ReadonlySignal } from "@preact/signals"
import { signal } from "@preact/signals"
import { isDefined } from "src/lib/array"
import { Propagate } from "src/lib/eventManager"
import { AnalyticsLegacy } from "./analytics"
import { useEffect } from "preact/hooks"
import { getTranslator, type I18nStringProvider } from "src/i18n"

export enum HotkeyCategory {
  "Sketch Tools",
  "Tools",
  "Selection",
  "Camera",
  "Clipboard",
  "History",
  "General",
  "Groups",
  "Snapping",
}

export type HotkeyKeyRegistration = {
  /** Human-readable description of the action this hotkey triggers */
  description: I18nStringProvider
  /** The key to bind */
  keyCode: string
  /** Whether this hotkey should only be active when user has edit access. */
  editAccessRequired: boolean
  /** Required state of shift key. Undefined means shift key doesn't matter. */
  shift?: boolean
  /** Required state of meta key. Undefined means meta key doesn't matter. */
  meta?: boolean
  /** Required state of alt key. Undefined means alt key doesn't matter. */
  alt?: boolean
  /** Required state of ctrl key. Undefined means ctrl key doesn't matter. */
  ctrl?: boolean
  callback: () => void
  /** Used to conditionally disable this hotkey registration */
  disabled?: boolean
  category?: HotkeyCategory | undefined
}

interface IHotkeyAPI {
  hotkeysSignal: ReadonlySignal<HotkeyKeyRegistration[]>
  registerHotkey(hotkey: HotkeyKeyRegistration): HotkeyKeyRegistration | undefined
  removeHotkey(hotkey: HotkeyKeyRegistration): void
  executeHotkey(e: KeyboardEvent, canEditProposal: boolean): Propagate
}

function overlappingRegistration(r1: HotkeyKeyRegistration, r2: HotkeyKeyRegistration) {
  return (
    isDefined(r1) &&
    isDefined(r2) &&
    !!r1.ctrl === !!r2.ctrl &&
    !!r1.shift === !!r2.shift &&
    !!r1.alt === !!r2.alt &&
    !!r1.meta == !!r2.meta &&
    r1.editAccessRequired === r2.editAccessRequired &&
    r1.keyCode === r2.keyCode
  )
}

function hotkeyRegistrationMatchesEvent(
  registration: HotkeyKeyRegistration,
  e: KeyboardEvent,
  hasEditAccess: boolean,
  multiKeyString: string,
) {
  const regKeyCode = registration.keyCode.toLowerCase()
  const keymatches = isMultiKey(regKeyCode)
    ? regKeyCode.startsWith(multiKeyString)
    : e.key.toLowerCase() === regKeyCode || e.code.toLowerCase() === regKeyCode
  const shiftMatches = e.shiftKey === !!registration.shift
  const altMatches = e.altKey === !!registration.alt
  const metaMatches = e.metaKey === !!registration.meta
  const ctrlMatches = e.ctrlKey === !!registration.ctrl
  const canAccess = hasEditAccess || !registration.editAccessRequired
  return keymatches && shiftMatches && metaMatches && ctrlMatches && altMatches && canAccess
}

function sameRegistration(r1: HotkeyKeyRegistration, r2: HotkeyKeyRegistration) {
  return overlappingRegistration(r1, r2) && r1.callback == r2.callback
}

function isMultiKey(str: string) {
  return str.indexOf(" ") > 0
}

function createHotkeyAPI(config: HotkeyKeyRegistration[]): IHotkeyAPI {
  const hotkeysSignal = signal<HotkeyKeyRegistration[]>(config)
  const multiKeyStringSignal = signal<string>("")
  let multiKeyTimeout: ReturnType<typeof setTimeout> | undefined
  return {
    hotkeysSignal,
    registerHotkey(registration: HotkeyKeyRegistration) {
      const current = hotkeysSignal.peek()
      const overlapping = current.find((hotkey) => overlappingRegistration(hotkey, registration))
      if (overlapping && sameRegistration(overlapping, registration)) return
      hotkeysSignal.value = [...current.filter((hotkey) => hotkey !== overlapping), registration]
      return overlapping
    },
    removeHotkey(registration: HotkeyKeyRegistration) {
      hotkeysSignal.value = hotkeysSignal.peek().filter((hotkey) => !sameRegistration(hotkey, registration))
    },
    executeHotkey(e: KeyboardEvent, canEditProposal: boolean) {
      const hotkeyCallbacks = hotkeysSignal.peek()
      const nextMultiKeyString = [multiKeyStringSignal, e.key.toLowerCase()].join(" ").trim()

      if (e.composedPath()[0] instanceof HTMLInputElement) return Propagate.YES
      const hasEditAccess = canEditProposal
      const matchingHotkey = hotkeyCallbacks.filter(
        (hotkey) =>
          !isMultiKey(hotkey.keyCode) && hotkeyRegistrationMatchesEvent(hotkey, e, hasEditAccess, nextMultiKeyString),
      )
      const matchingMultiHotkey = hotkeyCallbacks.filter(
        (hotkey) =>
          isMultiKey(hotkey.keyCode) && hotkeyRegistrationMatchesEvent(hotkey, e, hasEditAccess, nextMultiKeyString),
      )
      const handleHotKeyCallback = (hotkey: HotkeyKeyRegistration) => {
        //TODO: the callback() will often track itself. Don't double track!
        // Don't track this with new tracking schema.
        const t = getTranslator()
        AnalyticsLegacy.track(t.getText(hotkey.description), { method: "Hotkey" })
        hotkey.callback()
      }
      if (!matchingHotkey.length && !matchingMultiHotkey.length) return Propagate.YES
      if (matchingMultiHotkey.length) {
        if (matchingMultiHotkey.length === 1 && matchingMultiHotkey[0].keyCode.toLowerCase() == nextMultiKeyString) {
          // Clear timeout so any original non-multi hotkeys don't get called
          if (multiKeyTimeout) clearTimeout(multiKeyTimeout)
          // Reset the multikey string
          multiKeyStringSignal.value = ""
          e.preventDefault()
          // Call the callback
          handleHotKeyCallback(matchingMultiHotkey[0])
          return Propagate.NO
        } else {
          // Set new multikey string
          multiKeyStringSignal.value = nextMultiKeyString
          // Set timeout to reset multikey string
          if (multiKeyTimeout) clearTimeout(multiKeyTimeout)
          multiKeyTimeout = setTimeout(() => {
            multiKeyStringSignal.value = ""
            // Call the original non-multi hotkey
            if (matchingHotkey.length) {
              handleHotKeyCallback(matchingHotkey[0])
            }
          }, 550)
          return Propagate.YES
        }
      } else {
        e.preventDefault()
        if (matchingHotkey.length > 1) {
          console.warn("Overlapping hotkeys registered", matchingHotkey)
        }
        handleHotKeyCallback(matchingHotkey[0])
        return Propagate.NO
      }
    },
  }
}

export const hotkeyAPI = createHotkeyAPI([])

/**
 * Registers a hotkey
 * Also makes the hotkey available in the quick access listing
 */
export const useHotkey = (registration: HotkeyKeyRegistration) => {
  useEffect(() => {
    if (registration.disabled) return

    const existing = hotkeyAPI.registerHotkey(registration)
    return () => (existing ? hotkeyAPI.registerHotkey(existing) : hotkeyAPI.removeHotkey(registration))
  }, [registration])
}
