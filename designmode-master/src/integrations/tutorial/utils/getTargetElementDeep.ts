/**
 * Utility functions for finding target elements for tutorials
 * Based on designmode implementation
 */

/**
 * Searches for an element by id or data-tutorial-target attribute
 * Performs deep traversal including shadow DOM
 */
export function getTargetElementDeep(targetId: string): Element | null {
  // First try by ID
  let element = document.getElementById(targetId)
  if (element) return element

  // Then try by data-tutorial-target attribute
  element = document.querySelector(`[data-tutorial-target="${targetId}"]`)
  if (element) return element

  // Deep search including shadow DOM
  function searchInNode(node: Node): Element | null {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element

      // Check if this element matches
      if (el.id === targetId || el.getAttribute("data-tutorial-target") === targetId) {
        return el
      }

      // Search in shadow DOM if present
      if (el.shadowRoot) {
        const shadowResult = searchInShadowRoot(el.shadowRoot)
        if (shadowResult) return shadowResult
      }
    }

    // Search children
    for (const child of node.childNodes) {
      const result = searchInNode(child)
      if (result) return result
    }

    return null
  }

  function searchInShadowRoot(shadowRoot: ShadowRoot): Element | null {
    // Try direct query first
    let element = shadowRoot.getElementById(targetId)
    if (element) return element

    element = shadowRoot.querySelector(`[data-tutorial-target="${targetId}"]`)
    if (element) return element

    // Deep search
    for (const child of shadowRoot.childNodes) {
      const result = searchInNode(child)
      if (result) return result
    }

    return null
  }

  return searchInNode(document.body)
}

/**
 * Waits for a target element to appear in the DOM
 * Useful for elements that are rendered asynchronously
 */
export function waitForTargetElement(targetId: string, timeout = 5000, interval = 100): Promise<Element | null> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    const check = () => {
      const element = getTargetElementDeep(targetId)
      if (element) {
        resolve(element)
        return
      }

      if (Date.now() - startTime > timeout) {
        resolve(null)
        return
      }

      setTimeout(check, interval)
    }

    check()
  })
}
