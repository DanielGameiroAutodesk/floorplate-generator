declare module "@kninnug/constrainautor" {
  import type Delaunator from "delaunator"

  class Constrainautor {
    constructor(delaunay: Delaunator)

    constrainOne(start: number, end: number): void

    del: Delaunator
  }

  export default Constrainautor
}
