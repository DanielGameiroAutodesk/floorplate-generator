import { HandleProperties } from "src/integrations/HandleProperties/HandleProperties"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { EditMeshButton } from "src/integrations/3dsketch/EditIn3DSketch"
import { ColorProperty } from "src/integrations/VisualProperties/ColorProperty"
import { Functions } from "src/integrations/AnalysisProperties/Functions"
import AddFloors from "src/integrations/building-systems-basic-building/AddFloors"
import { GeneratorAdapter } from "src/integrations/extensions-generators/GeneratorAdapter"
import { TreeAreaProperties } from "src/integrations/basic-elements/trees/area/TreeAreaGeneratorProperties"
import { TreeLineProperties } from "src/integrations/basic-elements/trees/lines/TreeLinesProperties"
import {
  is3dSketchConstraintSelectedSignal,
  isElementEditableIn3DSketchWithCheckSignal,
} from "src/integrations/3dsketch/3dsketch-selection-state"
import { ExploreMenu } from "src/integrations/building-systems-site-study/ExploreMenu/ExploreMenu"
import { ExtensionsFloatingPanels } from "src/integrations/extensions/ExtensionsFloatingPanels/ExtensionsFloatingPanels"
import { SelectedRowHouses } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/sideBar/RowHousePropertyPanel"
import { BuildingSystemPropertyPanel } from "src/integrations/building-systems-common/BuildingSystemPropertiesPanel"
import { LineBuildingMenu } from "src/integrations/building-systems-line-buildings/LineBuildingMenu"
import { HandleWSMProperties } from "src/integrations/wsm-tools/edit/EditConstraintsProperties"
import LabelProperties from "src/integrations/labels/PropertyPanel/LabelPropertiesContainer"
import { useMemo } from "preact/hooks"
import { EditProperties } from "src/integrations/transportation/PropertyPanels/EditProperties"
import { SurfaceFunctions } from "src/integrations/AnalysisProperties/SurfaceFunctions"
import { IterativeExplorePropertyPanel } from "src/integrations/building-systems-site-study/iterative"
import { TerrainPadPropertyPanel } from "src/integrations/terrainPadsExperimental/components/TerrainPadPropertyPanel"

export const DefaultPropertyPanel = () => {
  const isElementEditableIn3DSketch = isElementEditableIn3DSketchWithCheckSignal.value
  const isElement3DConstraint = is3dSketchConstraintSelectedSignal.value
  const showWSMProperties = useMemo(() => {
    return isElementEditableIn3DSketch || isElement3DConstraint
  }, [isElement3DConstraint, isElementEditableIn3DSketch])

  return (
    <>
      {isElementEditableIn3DSketch && (
        <IfEditAccess>
          <EditMeshButton />
        </IfEditAccess>
      )}
      {showWSMProperties && <HandleWSMProperties />}
      <Functions />
      <ColorProperty />
      <SelectedRowHouses />
      <TreeAreaProperties />
      <TreeLineProperties />
      <EditProperties />
      {!showWSMProperties && <HandleProperties />}
      <SurfaceFunctions />
      <LineBuildingMenu />
      <ExploreMenu />
      <IfEditAccess>
        <AddFloors />
      </IfEditAccess>
      <GeneratorAdapter />
      <ExtensionsFloatingPanels />
      <LabelProperties />
      <IterativeExplorePropertyPanel />
      <BuildingSystemPropertyPanel />
      <TerrainPadPropertyPanel />
    </>
  )
}
