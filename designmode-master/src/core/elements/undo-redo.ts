import { isDefined } from "src/lib/array"

/** @internal */
export class UndoRedo<T> {
  private undoStack: T[]
  private redoStack: T[]
  private current: T | undefined

  constructor() {
    this.undoStack = []
    this.redoStack = []
    this.current = undefined
  }

  public undo(): T | undefined {
    const state = this.undoStack.pop()
    if (!isDefined(state)) {
      return
    }
    if (isDefined(this.current)) this.redoStack.push(this.current)
    this.current = state
    return this.current
  }

  public redo(): T | undefined {
    const state = this.redoStack.pop()
    if (!isDefined(state)) {
      return
    }
    if (isDefined(this.current)) this.undoStack.push(this.current)
    this.current = state
    return this.current
  }

  public canUndo() {
    return this.undoStack.length > 0
  }

  public canRedo() {
    return this.redoStack.length > 0
  }

  public push(state: T) {
    if (isDefined(this.current)) this.undoStack.push(this.current)
    this.current = state
    this.redoStack = []
  }

  public clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.current = undefined
  }
}
