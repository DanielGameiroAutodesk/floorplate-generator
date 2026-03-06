import ArrayUtils from "src/lib/array"

// Recursively traverse an object's structure and guesstimate the number of bytes consumed by it
// (inspired by https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object)
export function estimateObjectSize(object: any, alreadyCountedObjects?: Set<any>): number {
  // First, if object is undefined or null, let's assume it doesn't take any memory
  if (object === undefined) return 0
  if (object === null) return 0

  // For these primitive values we assume they aren't deduplicated by the VM, so let's just return some estimates
  if (typeof object == "number") return 8
  if (typeof object == "boolean") return 4
  if (typeof object == "symbol") return 8
  if (typeof object == "bigint") return 16

  // The rest of the code considers values that might be deduplicated by the VM (either because
  // they're strings, or object references pointing to the same objects)
  const alreadyCounted = alreadyCountedObjects ?? new Set()
  if (alreadyCounted.has(object)) {
    // Assume we still need a memory reference to the deduplicated object (8 bytes)
    return 8
  }
  alreadyCounted.add(object)

  // Assume strings are UTF-16 (2 bytes per character) with some arbitrary overhead
  const ARBITRARY_OVERHEAD = 8
  if (typeof object == "string") {
    return ARBITRARY_OVERHEAD + object.length * 2
  }
  // For typed arrays we can get the byte length directly
  if (object instanceof Uint8Array || object instanceof Float32Array) {
    return ARBITRARY_OVERHEAD + object.byteLength
  }
  // For array, sum the children and add some overhead
  if (Array.isArray(object)) {
    return ARBITRARY_OVERHEAD + ArrayUtils.sum(object.map((v) => estimateObjectSize(v, alreadyCounted)))
  }
  // As the final case, for a generic object, sum up all the properties and add some overhead
  return ARBITRARY_OVERHEAD + ArrayUtils.sum(Object.values(object).map((v) => estimateObjectSize(v, alreadyCounted)))
}
