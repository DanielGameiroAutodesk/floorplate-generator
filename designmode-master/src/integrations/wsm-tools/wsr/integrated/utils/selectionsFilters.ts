import type { SelectionItemProps } from "src/integrations/wsm-tools/wsr/integrated/types"

export const getSelectionFilters = (): SelectionItemProps[] => {
  return [
    {
      id: "vertices",
      label: (t) => t(($) => $.wsm.selection.filterVertices),
      acronym: "VS",
      selected: false,
    },
    {
      id: "edges",
      label: (t) => t(($) => $.wsm.selection.filterEdges),
      acronym: "ES",
      selected: false,
    },
    {
      id: "faces",
      label: (t) => t(($) => $.wsm.selection.filterFaces),
      acronym: "FS",
      selected: false,
    },
    {
      id: "bodies",
      label: (t) => t(($) => $.wsm.selection.filterSolids),
      acronym: "SS",
      selected: false,
    },
    {
      id: "instances",
      label: (t) => t(($) => $.wsm.selection.filterGroups),
      acronym: "GS",
      selected: false,
    },
    {
      id: "meshes",
      label: (t) => t(($) => $.wsm.selection.filterMeshes),
      acronym: "MS",
      selected: false,
    },
  ]
}
