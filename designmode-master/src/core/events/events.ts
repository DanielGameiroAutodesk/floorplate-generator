import { isDebugEnabled } from "src/lib/debug"
import type { InternalPath } from "src/lib/element/path"
import type { Transform, Urn } from "@spacemakerai/element-types"

const eventTarget = new EventTarget()

type DesignModeEventMap = {
  "tool.edit.start": CustomEvent<{ toolId: string }>
  "tool.edit.end": CustomEvent<undefined>

  "tool.affine.preview": CustomEvent<Transform>

  "clipping.changed": CustomEvent<undefined>

  "selection.changed": CustomEvent<{ paths: InternalPath[] }>

  "model.changed": CustomEvent<{ rootUrn: Urn }>

  "colorbar.range.changed": CustomEvent<{
    renderScope: string
    rangeFilter: {
      lowerIndex: number
      upperIndex: number
    }
  }>

  "test.event": CustomEvent<{ testData: string }>
}

type EventDetail<K extends keyof DesignModeEventMap> =
  DesignModeEventMap[K] extends CustomEvent<infer U extends object> ? U : never
type EventCallback<T> = T extends keyof DesignModeEventMap ? (evt: DesignModeEventMap[T]) => void : never

type EventKeysWithData = {
  [K in keyof DesignModeEventMap]: EventDetail<K> extends never ? never : K
}[keyof DesignModeEventMap]

type EventKeysWithoutData = {
  [K in keyof DesignModeEventMap]: EventDetail<K> extends never ? K : never
}[keyof DesignModeEventMap]

function dispatch<K extends EventKeysWithoutData>(type: K): void
function dispatch<K extends EventKeysWithData>(type: K, data: EventDetail<K>): void
function dispatch<K extends keyof DesignModeEventMap>(type: K, data?: EventDetail<K>): void {
  if (isDebugEnabled) {
    console.log("DesignModeEvent", type, data)
  }
  if (data) {
    eventTarget.dispatchEvent(new CustomEvent(type, { detail: data }))
  } else {
    eventTarget.dispatchEvent(new CustomEvent(type))
  }
}

function addListener<T extends keyof DesignModeEventMap>(type: T, listener: EventCallback<T>) {
  eventTarget.addEventListener(type, listener as EventListener)
}

function removeListener<T extends keyof DesignModeEventMap>(type: T, listener: EventCallback<T>) {
  eventTarget.removeEventListener(type, listener as EventListener)
}

export type { DesignModeEventMap, EventCallback, EventDetail }

export const DesignModeEvents = {
  dispatch,
  addListener,
  removeListener,
}
