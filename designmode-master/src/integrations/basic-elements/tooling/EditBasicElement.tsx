import type { InternalPath } from "src/lib/element/path"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import type { ToolCfg } from "src/core/toolsState"
import Edit2DLineElement from "./line/Edit2DLineElement"
import EditCircleElement from "./circle/EditCircleElement"
import EditPolygonElement from "./polygon/EditPolygonElement"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"

export const makeEditBasicElementToolCfg = (path: InternalPath): ToolCfg => ({
  id: "editBasicElement",
  tool: () => <EditBasicElement path={path} />,
  toolbar: () => <ToolbarCloseButton />,
  propertyPanel: "default",
})

function EditBasicElement({ path }: { path: InternalPath }) {
  const snapshot = elementState.currentSnapshot.value
  const node = snapshot.getNode(path)
  const element = node?.element
  const geojson = node?.elementContainer.representations.footprint

  const is25D = geojson?.properties && "height" in geojson.properties && "elevation" in geojson.properties
  const dimension = is25D ? "2.5D" : "2D"

  const isCircular = element?.properties && "circleDefinition" in element.properties

  if (!geojson || !element) {
    console.error("missing element to edit")
    exitCurrentTool()
    return null
  }
  if (isCircular) {
    return <EditCircleElement path={path} element={element} geojson={geojson} dimension={dimension} />
  }

  if (geojson.geometry.type === "Polygon") {
    return <EditPolygonElement path={path} element={element} geojson={geojson} dimension={dimension} />
  }

  if (geojson.geometry.type === "LineString") {
    return <Edit2DLineElement path={path} element={element} geojson={geojson} />
  }

  console.error("element not supported by editBasicTool", element, path)
  exitCurrentTool()
  return null
}
