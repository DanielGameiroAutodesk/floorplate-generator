/**
 * Checks if an element is a clickable button-like element.
 * Returns true if the element is a button, has button role, or is a web component with "button" in its name.
 * Returns false if the element is disabled.
 */
export function isClickableElement(element: Element): boolean {
  // Check if it's a button element
  if (element.tagName.toLowerCase() === "button") {
    // Check if it's disabled
    if (element.hasAttribute("disabled")) return false
    return true
  }

  // Check if it has button role
  if (element.getAttribute("role") === "button") {
    // Check if it's disabled via aria
    if (element.getAttribute("aria-disabled") === "true") return false
    return true
  }

  // Check if it's a web component with "button" in the name (e.g., weave-icon-button)
  if (element.tagName.toLowerCase().includes("button")) {
    // Check if it's disabled
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false
    return true
  }

  return false
}
