import "@testing-library/jest-dom/vitest"
import { URL } from "node:url"
import { vi } from "vitest"
import indexeddb from "fake-indexeddb"

window.__SUBMODE_WITH_OWN_SCENE_ACTIVE__ = false

// Node defaults to only showing 10 frames.
// Show all to help with looking into circular dependency issues.
Error.stackTraceLimit = Infinity

globalThis.indexedDB = indexeddb

vi.mock("three", async () => {
  const THREE = await vi.importActual("three")
  return {
    ...THREE,
    WebGLRenderer: vi.fn().mockReturnValue({
      domElement: document.createElement("div"), // create a fake div
      setSize: vi.fn(),
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      shadowMap: {},
      capabilities: {
        maxTextureSize: 4096,
      },
    }),
  }
})

// jsdom does not yet support Cache API
// See https://github.com/jsdom/jsdom/issues/2422
const caches: CacheStorage = {
  delete: vi.fn(),
  has: vi.fn(),
  match: vi.fn(),
  keys: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  open: () => Promise.reject("not implemented"),
}
vi.stubGlobal("caches", caches)

// Replace jsdom URL with URL from Node, so that they are the nominally same types.
// Otherwise e.g. code from forma-units don't work during tests.
// @ts-expect-error: Override type.
globalThis.URL = URL
