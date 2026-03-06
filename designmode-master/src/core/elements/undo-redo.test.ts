import { describe, beforeEach, test, expect } from "vitest"
import { UndoRedo } from "./undo-redo"

function nextState(prevState: number): number {
  return prevState + 1
}

describe("UndoRedo", () => {
  let undoRedo: UndoRedo<number>

  beforeEach(() => {
    undoRedo = new UndoRedo<number>()
  })

  test("Undo one change goes back to initial state ", () => {
    const initialState = 0
    undoRedo.push(initialState)
    const newState = nextState(initialState)
    undoRedo.push(newState)
    expect(undoRedo.undo()).toBe(initialState)
  })

  test("undo twice gives the changes in the reverse order", () => {
    const initialState = 0
    undoRedo.push(initialState)
    const newState = nextState(initialState)
    undoRedo.push(newState)
    const new2State = nextState(newState)
    undoRedo.push(new2State)
    expect(undoRedo.undo()).toBe(newState)
    expect(undoRedo.undo()).toBe(initialState)
  })

  test("redo once after one undo goes back to latest state", () => {
    const initialState = 0
    undoRedo.push(initialState)
    const newState = nextState(initialState)
    undoRedo.push(newState)
    undoRedo.undo()
    expect(undoRedo.redo()).toBe(newState)
  })

  test("push clears the redo stack", () => {
    const initialState = 0
    undoRedo.push(initialState)
    const newState = nextState(initialState)
    undoRedo.push(newState)
    undoRedo.undo()
    undoRedo.push(1337)
    expect(undoRedo.redo()).toBeUndefined()
  })

  test("clear empties both stacks", () => {
    const initialState = 0
    undoRedo.push(initialState)
    const newState = nextState(initialState)
    undoRedo.push(newState)
    undoRedo.clear()
    expect(undoRedo.undo()).toBeUndefined()
    expect(undoRedo.redo()).toBeUndefined()
  })

  test("redo gets first element from redo stack after several undos", () => {
    const state0 = 0
    undoRedo.push(state0)
    const state1 = nextState(state0)
    undoRedo.push(state1)
    const state2 = nextState(state1)
    undoRedo.push(state2)
    const state3 = nextState(state2)
    undoRedo.push(state3)
    undoRedo.undo()
    undoRedo.undo()
    undoRedo.undo()
    expect(undoRedo.redo()).toBe(state1)
    expect(undoRedo.redo()).toBe(state2)
    expect(undoRedo.redo()).toBe(state3)
  })
})
