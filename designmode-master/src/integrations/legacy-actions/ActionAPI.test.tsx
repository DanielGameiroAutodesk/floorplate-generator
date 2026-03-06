import { renderHook } from "@testing-library/preact"
import { describe, expect, it, vi } from "vitest"
import { useActionAPI } from "./ActionAPI"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { Action } from "src/core/legacy-actions"
import { ROOT_KEY } from "src/lib/element/path"
import { createUrn } from "src/lib/element/urn"
import { mapOfFormaElements } from "src/lib/element/utils"
import { createRepresentationsByUrnForTest } from "src/core/elements/testUtils"

// For some reason this import fails due to some dependency trees
vi.mock("../../tools/UndoRedoHotkeyBindings.tsx", () => ({}))

describe("ActionsAPI", () => {
  describe("__setup__", () => {
    it("should be able to render hook", () => {
      const { result } = renderHook(useActionAPI)
      expect(result.current).toBeDefined()
    })
  })

  describe("add", () => {
    describe("one", () => {
      const { result } = renderHook(useActionAPI)
      const actions = result.current.add.one({} as FormaElement, true)
      describe("adding one element", () => {
        it("should result in a single action", () => {
          expect(actions).toHaveLength(1)
        })
        it("should have type add", () => {
          const action = actions[0]
          expect(action.type).toEqual("add")
          expect((action as Action<"add">).parentPath).toEqual(ROOT_KEY)
        })
      })
    })

    describe("subTree", () => {
      const { result } = renderHook(useActionAPI)
      const parent: Urn = createUrn("test", "test", "root", "1")
      const child1: Urn = createUrn("test", "test", "child1", "1")
      const child2: Urn = createUrn("test", "test", "child2", "1")

      const elements = mapOfFormaElements(
        {
          urn: parent,
          children: [
            { urn: child1, key: "child1" },
            { urn: child2, key: "child2" },
          ],
        },
        { urn: child1 },
        { urn: child2 },
      )

      const actions = result.current.add.subTree_UNSTABLE(
        parent,
        elements,
        new Set(),
        createRepresentationsByUrnForTest(),
      )

      it("should be able to add subtree", () => {
        // console.log(actions)
        expect(actions).toHaveLength(3)
      })
    })
  })
})
