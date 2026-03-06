import {
  Array,
  ConvertMeshSvgIcon,
  DetachGroup,
  ExtrudeEdges,
  ExtrudeIcon,
  FacetFace,
  FlattenFace,
  Group,
  Mirror,
  MoveIcon,
  OffsetEdges,
  OffsetFace,
  ReverseFace,
  RotateIcon,
  Scale,
  ScaleNU,
  SmoothEdges,
  TiltFace,
  Ungroup,
} from "src/integrations/wsm-tools/wsr/svg-icons"
import useCheckSelection from "src/integrations/wsm-tools/wsr/integrated/hooks/useCheckSelection"
import { ToolbarGroupedButton, type ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { useCallback, useMemo } from "preact/hooks"
import { useRecoilState, useRecoilValue } from "recoil"
import { wsmActiveToolState } from "src/integrations/wsm-tools/wsr/integrated/state"
import { formItContextToolInfoToShowState } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { getAvailableGroupTools } from "src/integrations/wsm-tools/wsr/integrated/utils"
import {
  getNameFromFormItCommand,
  getNameFromToolType,
  getShortcutFromToolType,
} from "src/integrations/wsm-tools/wsr/toolMeta"
import { Analytics } from "src/core/analytics"

import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { wsmEditMode } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"

const shouldRender = (
  hasSelectedSomething: boolean,
  hasSelectedFaces: boolean,
  hasOneFaceSelected: boolean,
  hasMultipleFacesSelected: boolean,
  areSmoothEdgeInSelection: boolean,
  hasSelectedEdges: boolean,
  toolType: number,
  hasMeshesInSelection: boolean,
) => {
  if (toolType === FormIt.ToolType.DRAG_FACE) {
    return (hasOneFaceSelected || hasSelectedFaces) && !areSmoothEdgeInSelection
  }

  // Extrude Edges & Offset Edges & Smooth Edges
  if ([FormIt.ToolType.EXTRUDE_EDGES, FormIt.ToolType.OFFSET_EDGES, FormIt.ToolType.SMOOTH_EDGES].includes(toolType)) {
    return hasSelectedEdges
  }

  // Offset Face & Tilt Face
  if ([FormIt.ToolType.OFFSET_FACE, FormIt.ToolType.TAPER_FACE].includes(toolType)) {
    return hasOneFaceSelected
  }

  // Reverse Face
  if (toolType === FormIt.ToolType.REVERSE_FACE) {
    return hasSelectedFaces
  }

  // Flatten Faces
  if (toolType === FormIt.ToolType.FLATTEN_FACES) {
    return hasMultipleFacesSelected
  }

  // Facet Face
  if (toolType === FormIt.ToolType.UNSMOOTH_EDGES) {
    return hasMultipleFacesSelected && areSmoothEdgeInSelection
  }

  // Mesh to Objects
  if (toolType === FormIt.ToolType.MESHES_TO_OBJECTS) {
    return hasMeshesInSelection
  }

  return hasSelectedSomething
}

const getExplicitTools = (): ToolConfig[] => [
  {
    label: (t) => t(($) => $.wsm.tools.move),
    shortCut: getShortcutFromToolType(FormIt.ToolType.TRANSLATION),
    icon: MoveIcon,
    toolType: FormIt.ToolType.TRANSLATION,
  },
  {
    label: (t) => t(($) => $.wsm.tools.rotate),
    shortCut: getShortcutFromToolType(FormIt.ToolType.ROTATION),
    icon: RotateIcon,
    toolType: FormIt.ToolType.ROTATION,
  },
  {
    label: (t) => t(($) => $.wsm.tools.meshToObjects),
    shortCut: getShortcutFromToolType(FormIt.ToolType.MESHES_TO_OBJECTS),
    icon: ConvertMeshSvgIcon,
    toolType: FormIt.ToolType.MESHES_TO_OBJECTS,
    command: "Meshes to Objects",
  },
  {
    label: (t) => t(($) => $.wsm.tools.extrudeFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.DRAG_FACE),
    icon: ExtrudeIcon,
    toolType: FormIt.ToolType.DRAG_FACE,
  },
  {
    label: (t) => t(($) => $.wsm.tools.offsetFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.OFFSET_FACE),
    icon: OffsetFace,
    toolType: FormIt.ToolType.OFFSET_FACE,
  },
  {
    label: (t) => t(($) => $.wsm.tools.tiltFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.TAPER_FACE),
    icon: TiltFace,
    toolType: FormIt.ToolType.TAPER_FACE,
  },
  {
    label: (t) => t(($) => $.wsm.tools.reverseFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.REVERSE_FACE),
    icon: ReverseFace,
    toolType: FormIt.ToolType.REVERSE_FACE,
    command: "Tools: Reverse Faces",
  },
  {
    label: (t) => t(($) => $.wsm.tools.facetFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.UNSMOOTH_EDGES),
    icon: FacetFace,
    toolType: FormIt.ToolType.UNSMOOTH_EDGES,
    command: "Tools: Unsmooth Edges",
  },
  {
    label: (t) => t(($) => $.wsm.tools.flattenFace),
    shortCut: getShortcutFromToolType(FormIt.ToolType.FLATTEN_FACES),
    icon: FlattenFace,
    toolType: FormIt.ToolType.FLATTEN_FACES,
    command: "Tools: Flatten Faces",
  },
  {
    label: (t) => t(($) => $.wsm.tools.extrudeEdges),
    shortCut: getShortcutFromToolType(FormIt.ToolType.EXTRUDE_EDGES),
    icon: ExtrudeEdges,
    toolType: FormIt.ToolType.EXTRUDE_EDGES,
    command: "Tools: Extrude Edges",
  },
  {
    label: (t) => t(($) => $.wsm.tools.offsetEdges),
    shortCut: getShortcutFromToolType(FormIt.ToolType.OFFSET_EDGES),
    icon: OffsetEdges,
    toolType: FormIt.ToolType.OFFSET_EDGES,
    command: "Tools: Offset Edges",
  },
  {
    label: (t) => t(($) => $.wsm.tools.smoothEdges),
    shortCut: getShortcutFromToolType(FormIt.ToolType.SMOOTH_EDGES),
    icon: SmoothEdges,
    toolType: FormIt.ToolType.SMOOTH_EDGES,
    command: "Tools: Smooth Edges",
  },
  {
    label: (t) => t(($) => $.wsm.tools.array),
    shortCut: getShortcutFromToolType(FormIt.ToolType.ARRAY),
    icon: Array,
    toolType: FormIt.ToolType.ARRAY,
    command: "Tools: Array",
  },
  {
    label: (t) => t(($) => $.wsm.tools.mirror),
    shortCut: getShortcutFromToolType(FormIt.ToolType.MIRROR),
    icon: Mirror,
    toolType: FormIt.ToolType.MIRROR,
    command: "Tools: Mirror",
  },
]

export const ExplicitToolsToolbar = () => {
  const {
    hasSelectedFaces,
    hasSelectedSomething,
    hasOneFaceSelected,
    hasMultipleFacesSelected,
    areSmoothEdgeInSelection,
    hasSelectedEdges,
    hasMeshesInSelection,
  } = useCheckSelection()

  const [wsmActiveTool, setWSMActiveTool] = useRecoilState(wsmActiveToolState)

  const contextualToolsFromFormIt = useRecoilValue(formItContextToolInfoToShowState)
  const availableGroupTools = getAvailableGroupTools(contextualToolsFromFormIt)

  const editMode = useRecoilValue(wsmEditMode)

  const explicitTools = useMemo(
    () =>
      getExplicitTools().filter((tool) =>
        shouldRender(
          hasSelectedSomething,
          hasSelectedFaces,
          hasOneFaceSelected,
          hasMultipleFacesSelected,
          areSmoothEdgeInSelection,
          hasSelectedEdges,
          tool.toolType!,
          hasMeshesInSelection,
        ),
      ),
    [
      areSmoothEdgeInSelection,
      hasMeshesInSelection,
      hasMultipleFacesSelected,
      hasOneFaceSelected,
      hasSelectedEdges,
      hasSelectedFaces,
      hasSelectedSomething,
    ],
  )
  const activateFormItTool = useCallback(
    (toolType: FormIt.ToolType) => {
      FormIt.Tools.StartTool(toolType)
      setWSMActiveTool(toolType)
    },
    [setWSMActiveTool],
  )

  const scaleTools: ToolConfig[] = useMemo(
    () => [
      {
        label: (t) => t(($) => $.wsm.tools.scale),
        icon: Scale,
        shortCut: "SC",
        onClick: () => {
          activateFormItTool(FormIt.ToolType.SCALE_OBJECTS)
        },
        active: wsmActiveTool === FormIt.ToolType.SCALE_OBJECTS,
      },
      {
        label: (t) => t(($) => $.wsm.tools.scaleNonUniform),
        icon: ScaleNU,
        shortCut: "NU",
        onClick: () => {
          activateFormItTool(FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS)
        },
        active: wsmActiveTool === FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS,
      },
    ],
    [activateFormItTool, wsmActiveTool],
  )

  const groupTools: ToolConfig[] = useMemo(
    () => [
      {
        label: (t) => t(($) => $.wsm.tools.group),
        icon: Group,
        shortCut: "G",
        onClick: () => {
          activateFormItTool(FormIt.ToolType.GROUP_CONTEXTMENU)
          Analytics.trackSelectTool(
            "3dSketch",
            getNameFromToolType(FormIt.ToolType.GROUP_CONTEXTMENU),
            "toolbar",
            "design-tool",
          )
        },
        active: wsmActiveTool === FormIt.ToolType.GROUP_CONTEXTMENU,
      },
      {
        label: (t) => t(($) => $.wsm.tools.ungroup),
        icon: Ungroup,
        shortCut: "U",
        onClick: () => {
          activateFormItTool(FormIt.ToolType.UNGROUP_CONTEXTMENU)
          Analytics.trackSelectTool(
            "3dSketch",
            getNameFromToolType(FormIt.ToolType.UNGROUP_CONTEXTMENU),
            "toolbar",
            "design-tool",
          )
        },
        active: wsmActiveTool === FormIt.ToolType.UNGROUP_CONTEXTMENU,
      },
      {
        label: (t) => t(($) => $.wsm.tools.groupDetach),
        icon: DetachGroup,
        shortCut: "D",
        onClick: () => {
          activateFormItTool(FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU)
          Analytics.trackSelectTool(
            "3dSketch",
            getNameFromToolType(FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU),
            "toolbar",
            "design-tool",
          )
        },
        active: wsmActiveTool === FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU,
      },
    ],
    [activateFormItTool, wsmActiveTool],
  )

  const scaleToolbarGroup = useMemo(
    () => (
      <ToolbarGroupedButton
        id={"scale-toolbar" + editMode}
        title={(t) => t(($) => $.wsm.scaleTitle)}
        configs={scaleTools}
        active={scaleTools.some((s) => s.active)}
      />
    ),
    [editMode, scaleTools],
  )

  // the single group tool
  const groupTool = (): ToolConfig => ({
    label: (t) => t(($) => $.wsm.tools.group),
    shortCut: getShortcutFromToolType(FormIt.ToolType.GROUP_CONTEXTMENU),
    icon: Group,
    toolType: FormIt.ToolType.GROUP_CONTEXTMENU,
  })
  const groupToolButton = () => {
    const tool = groupTool()
    return (
      <ToolbarButton
        key={tool.toolType}
        icon={<tool.icon />}
        label={tool.label}
        shortCut={tool?.shortCut}
        active={wsmActiveTool === tool.toolType}
        onClick={() => {
          FormIt.Tools.StartTool(tool.toolType)
          setWSMActiveTool(tool.toolType!)
          if (tool.toolType) {
            Analytics.trackSelectTool("3dSketch", getNameFromToolType(tool.toolType), "toolbar", "design-tool")
          }
        }}
      />
    )
  }

  // the group of group tools
  const groupToolbarGroup = useMemo(
    () => (
      <ToolbarGroupedButton
        id={"group-toolbar" + editMode}
        title={(t) => t(($) => $.wsm.grouping.toolbarTitle)}
        configs={groupTools}
        active={groupTools.some((s) => s.active)}
      />
    ),
    [editMode, groupTools],
  )

  // group tool offerings will depend on selection
  // a selection without groups will offer only the group tool
  // but a selection with existing groups will also offer ungroup and make unique
  const renderGroupOfferings = () => {
    if (availableGroupTools.length > 1) {
      return groupToolbarGroup
    } else if (availableGroupTools.length === 1) {
      return groupToolButton()
    } else {
      return null
    }
  }

  return (
    <>
      {explicitTools.length > 0 && <FormaToolbarDivider direction="vertical" />}
      {explicitTools.map((tool) => (
        <ToolbarButton
          key={tool.toolType}
          icon={tool.icon()}
          label={tool.label}
          shortCut={tool?.shortCut}
          active={wsmActiveTool === tool.toolType}
          onClick={() => {
            tool.command ? FormIt.Commands.DoCommand(tool.command) : FormIt.Tools.StartTool(tool.toolType)
            setWSMActiveTool(tool.toolType!)
            // converting meshes to objects isn't captured by the
            // analytics useEffect() hook, so capture it manually
            if (tool.command === "Meshes to Objects") {
              Analytics.trackSelectTool(
                "3dSketch",
                getNameFromFormItCommand("Meshes to Objects"),
                "toolbar",
                "design-tool",
              )
            }
          }}
        />
      ))}
      {explicitTools.length > 0 && scaleToolbarGroup}
      {renderGroupOfferings()}
    </>
  )
}
