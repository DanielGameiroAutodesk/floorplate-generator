import type { FormaElement } from "@spacemakerai/element-types"

const frozenElements = new WeakSet<FormaElement>()

/**
 * Deeply object freeze a FormaElement to prevent any mutations to it.
 *
 * This ensures we don't violate the immutable principle we rely on.
 * Relying on this means we avoid having to copy data all the times we
 * need guarantees for what modifications can (cannot) take place.
 *
 * It's not required to call this, and we can in theory remove it any time,
 * but it helps us detect code that does not follow the rules.
 */
export function freezeFormaElement(value: FormaElement): FormaElement {
  // Do this in production later - "dry running" locally first.
  if (!window.location.host.includes("local")) return value

  if (frozenElements.has(value)) {
    return value
  }

  deepFreeze(value)
  frozenElements.add(value)
  return value
}

// Inspired by https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
function deepFreeze(object: any) {
  const propNames = Reflect.ownKeys(object)

  for (const name of propNames) {
    const value = object[name]
    if ((value && typeof value === "object") || typeof value === "function") {
      deepFreeze(value)
    }
  }

  Object.freeze(object)
}
