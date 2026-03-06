import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { isOnMac } from "src/lib/measurementSystem"
import { useCallback, useMemo } from "preact/compat"
import { elementState } from "src/core/elements/ElementState"
import { HotkeyCategory } from "src/core/hotkeys"
import { resetSelectionSetSignal } from "src/core/selection/selectionState"

export const Hotkey = (registration: HotkeyKeyRegistration) => {
  useHotkey(registration)
  return null
}

export const UndoRedoHotkeyBindings = () => {
  const undo = useCallback(() => {
    elementState.undo()
    resetSelectionSetSignal()
  }, [])

  const redo = useCallback(() => {
    elementState.redo()
    resetSelectionSetSignal()
  }, [])

  const hotkeys = useMemo<HotkeyKeyRegistration[]>(() => {
    if (isOnMac) {
      return [
        {
          description: (t) => t(($) => $.hotkeys.undo),
          keyCode: "z",
          meta: true,
          shift: false,
          editAccessRequired: false,
          callback: undo,
          category: HotkeyCategory.History,
        },
        {
          description: (t) => t(($) => $.hotkeys.redo),
          keyCode: "z",
          meta: true,
          shift: true,
          editAccessRequired: false,
          callback: redo,
          category: HotkeyCategory.History,
        },
      ]
    }
    return [
      {
        description: (t) => t(($) => $.hotkeys.undo),
        keyCode: "z",
        ctrl: true,
        editAccessRequired: false,
        callback: undo,
        category: HotkeyCategory.History,
      },
      {
        description: (t) => t(($) => $.hotkeys.redo),
        keyCode: "y",
        ctrl: true,
        editAccessRequired: false,
        callback: redo,
        category: HotkeyCategory.History,
      },
    ]
  }, [redo, undo])

  return (
    <>
      {hotkeys.map((hotkey, i) => (
        <Hotkey key={i} {...hotkey} />
      ))}
    </>
  )
}
