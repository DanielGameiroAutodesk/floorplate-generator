import { useEffect } from "preact/compat"

export type EventHandler<K extends EventType> = (event: WindowEventMap[K]) => Propagate

// Priority for event handlers. Ordered with decreasing priority.
//
// For each event type, only one handler per priority is supported. If you need a new handler,
// you can create a new priority and insert it in a reasonable position to set the priority level.
//
// If you add two handlers with the same priority, you will get a waring in the console. Doing so
// is considered undefined behavior (https://en.wikipedia.org/wiki/Undefined_behavior)

export enum Priority {
  ORBIT = "ORBIT",
  RIGHT_CLICK = "RIGHT_CLICK",
  TOOL_INPUT_CONTROL = "TOOL_INPUT_CONTROL",
  TOOL_INPUT = "TOOL_INPUT",
  TOOL_SNAPPING = "TOOL_SNAPPING",
  WSM_TOOL_SNAPPING = "WSM_TOOL_SNAPPING",
  COMPUTE_MOUSE_POSITION = "COMPUTE_MOUSE_POSITION",
  SUBTOOL_LVL2 = "SUBTOOL_LVL2",
  SUBTOOL = "SUBTOOL",
  TOOL = "TOOL",
  SECTION_PUSH_PULL = "SECTION_PUSH_PULL",
  PUSH_PULL = "PUSH_PULL",
  MOVE_TOOL = "MOVE_TOOL",
  AFFINE_TOOL = "AFFINE_TOOL",
  SELECTION_V2 = "SELECTION_V2",
  SELECTION = "SELECTION",
  HOTKEYS = "HOTKEYS",
}

export enum Propagate {
  YES = "YES",
  NO = "NO",
}

export type EventType = keyof WindowEventMap

type State = {
  [type in EventType]?: {
    [index in Priority]: { handler: EventHandler<type>; domElement: HTMLElement | null }
  }
}

let state: State = {}

export const addEventHandler = <K extends EventType>(
  type: K,
  handler: EventHandler<K>,
  priority: Priority,
  domElement?: HTMLElement,
) => {
  const stateForType = state[type]
  if (stateForType && stateForType[priority] && stateForType[priority].handler !== handler) {
    console.group()
    console.warn(
      `Trying to add new event handler of type "${type}" and priority "${priority}", but there exists one already.`,
    )
    console.warn("Previous handler:")
    console.warn(stateForType[priority])
    console.warn("New handler: ")
    console.warn(handler)
    console.groupEnd()
  }
  if (!state[type]) window.addEventListener(type, handleEvent)

  state = {
    ...state,
    [type]: {
      ...state[type],
      [priority]: { handler, domElement },
    },
  }
}

export const removeEventHandler = <K extends EventType>(type: K, priority: Priority) => {
  state = {
    ...state,
    [type]: {
      ...state[type],
      [priority]: null,
    },
  }
}

const handleEvent = <T extends EventType>(event: WindowEventMap[T]): void => {
  if (window.__SUBMODE_WITH_OWN_SCENE_ACTIVE__) return
  const eventTypeHandlers = state[event.type as EventType]
  if (!eventTypeHandlers) return
  for (const priority in Priority) {
    const handlerObj = eventTypeHandlers[priority as Priority]
    if (handlerObj) {
      const { handler, domElement } = handlerObj
      // If the handler has a domElement together with it, only run it if the event has happend inside it
      if (domElement && event.target && !domElement.contains(event.target as HTMLElement)) {
        continue
      }
      const result = handler(event as any)
      if (result === Propagate.NO) {
        return
      }
    }
  }
}

export const useEventHandler = <T extends EventType>(
  type: T,
  handler: EventHandler<T>,
  priority: Priority,
  domElement?: HTMLElement,
) => {
  useEffect(() => {
    addEventHandler(type, handler, priority, domElement)
    return () => {
      removeEventHandler(type, priority)
    }
  }, [domElement, handler, priority, type])
}
