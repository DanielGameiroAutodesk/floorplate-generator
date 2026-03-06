import type { Child, ElementResponse, FormaElement, Urn } from "@spacemakerai/element-types"
import { parseUrn } from "./element/urn"
import { freezeFormaElement } from "./element/freeze"

// Lightweight validators/assertors to be used instead of casts for API responses.
// This should only be used for safe content (i.e. not for third-party content),
// as the content is not extensively verified.

export function isFormaElement(data: unknown): data is FormaElement {
  const isValidChildRef = (child: any): child is Child => typeof child === "object" && child.urn && child.key
  if (data == null || typeof data !== "object" || !("urn" in data)) {
    return false
  }

  if (!data.urn) {
    return false
  }

  if ("children" in data) {
    if (!Array.isArray(data.children) || !data.children.every(isValidChildRef)) {
      return false
    }
  }

  return true
}

export function assertIsFormaElement(data: unknown): asserts data is FormaElement {
  if (!isFormaElement(data)) {
    console.error("Value returned from endpoint was not a valid FormaElement.", data)
    throw new Error("Value returned from endpoint was not a valid FormaElement.")
  }
  freezeFormaElement(data)
}

export function validateIsFormaElement(data: unknown): FormaElement {
  assertIsFormaElement(data)
  freezeFormaElement(data)
  return data
}

export function isValidElementResponse(data: unknown): data is ElementResponse {
  if (data == null || typeof data !== "object") {
    return false
  }

  return Object.values(data).every(isFormaElement)
}

export function assertIsElementResponse(data: unknown): asserts data is ElementResponse {
  if (!isValidElementResponse(data)) {
    console.error("Value returned from endpoint was not a valid ElementResponse.", data)
    throw new Error("Value returned from endpoint was not a valid ElementResponse.")
  }
}

export function validateIsElementResponse(data: unknown): ElementResponse {
  assertIsElementResponse(data)
  return data
}

export function isUrn(data: unknown): data is Urn {
  try {
    // TODO: Consider using formaURNValidator from spacemaker-primitives.
    const { authcontext, id, revision, system } = parseUrn(data as Urn)
    if (!authcontext || !id || !revision || !system) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function assertIsUrn(data: unknown): asserts data is Urn {
  if (!isUrn(data)) {
    throw new Error(`Not a valid URN: ${JSON.stringify(data)}`)
  }
}

export function validateIsUrn(data: unknown): Urn {
  assertIsUrn(data)
  return data
}
