import type { EmbeddedViewHostContext as Context, DesignModeEventData } from "./generated-types"
import { DesignModeEvents, type EventCallback, type EventDetail } from "src/core/events/events"
import type { InternalPath } from "src/lib/element/path"
import type { Urn } from "forma-elements"

/**
 * Event mapping functions that transform internal design mode events before exposing them to extensions.
 *
 * These functions act as a security boundary - they filter and sanitize event data to prevent
 * extensions from accessing internal implementation details that could create tight coupling.
 *
 * When adding new events: carefully consider what data to expose. Default to exposing less
 * rather than more to maintain API stability and security.
 */
const eventMappingFunctions: {
  [K in keyof DesignModeEventData]: (detail: EventDetail<K>) => DesignModeEventData[K]
} = {
  "tool.edit.start": () => undefined,
  "tool.edit.end": () => undefined,
  "selection.changed": (detail: { paths: InternalPath[] }) => ({ paths: detail.paths }),
  "model.changed": (detail: { rootUrn: Urn }) => ({ rootUrn: detail.rootUrn }),
  "colorbar.range.changed": (detail: {
    renderScope: string
    rangeFilter: { lowerIndex: number; upperIndex: number }
  }) => ({
    renderScope: detail.renderScope,
    rangeFilter: detail.rangeFilter,
  }),
}

export function createDesignEventsApi(): Context["designEventsApi"] {
  const callbackMap: Map<unknown, any> = new Map()

  function addListener<T extends keyof DesignModeEventData>(
    eventName: T,
    callback: (evt: CustomEvent<DesignModeEventData[T]>) => void,
  ) {
    const mappingFunction = eventMappingFunctions[eventName]
    if (!mappingFunction) {
      throw new Error(`No mapping function found for event ${eventName}`)
    }

    function onEvent(evt: CustomEvent<EventDetail<T>>) {
      const event = new CustomEvent(eventName, { detail: mappingFunction(evt.detail) })
      callback(event)
    }
    callbackMap.set(callback, onEvent)
    DesignModeEvents.addListener(eventName, onEvent as EventCallback<T>)
  }

  function removeListener<T extends keyof DesignModeEventData>(
    eventName: T,
    callback: (evt: CustomEvent<DesignModeEventData[T]>) => void,
  ) {
    const onEvent = callbackMap.get(callback)
    if (onEvent) {
      DesignModeEvents.removeListener(eventName, onEvent)
      callbackMap.delete(callback)
    }
  }

  return {
    addListener,
    removeListener,
  }
}
