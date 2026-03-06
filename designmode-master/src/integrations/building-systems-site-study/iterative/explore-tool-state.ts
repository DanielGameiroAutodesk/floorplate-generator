import type { InternalPath } from "src/lib/element/path"

import type { ExploreGraphEditorState } from "./graph-edit"

export type IterativeExploreState =
  | { type: "property-panel" }
  | {
      type: "graph-editor"
      exploreGraphEditorState: ExploreGraphEditorState
      selectedCells: Set<InternalPath>
    }
  | {
      type: "set-grid-position"
    }
