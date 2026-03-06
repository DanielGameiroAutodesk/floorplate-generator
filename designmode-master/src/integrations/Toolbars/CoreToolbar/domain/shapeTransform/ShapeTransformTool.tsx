import { atom, useRecoilState } from "recoil"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { useCallback, useState } from "preact/compat"
import { selectionOnlyContainsPolygonsSignalFamily } from "src/integrations/tools-common/shapeTransformTools/shapeTransformTools.state"
import UnionIcon from "./icons/UnionIcon"
import useBooleanOperation from "src/integrations/tools-common/shapeTransformTools/boolean/useBooleanOperation"
import PolygonBoolean from "polygon-clipping"
import ToolbarButtonWithMenu, {
  ToolbarButtonInMenu,
} from "src/integrations/toolbar/ToolbarButton/ToolbarButtonWithMenu"
import IntersectIcon from "./icons/IntersectIcon"
import SplitIconLarge from "./icons/SplitIcon"
import SubtractIcon from "./icons/SubtractIcon"
import OffsetButton from "src/integrations/tools-common/shapeTransformTools/offset/OffsetButton"
import OffsetIcon from "./icons/OffsetIcon"
import { helpLinkDrawInDesignMode } from "src/lib/helpLinks"
import UnionGif from "./gifs/Union_tooltip.gif"
import SubtractGif from "./gifs/Subtract_tooltip.gif"
import IntersectGif from "./gifs/Intersect_tooltip.gif"
import SplitGif from "./gifs/Split_tooltip.gif"
import { SplitTool } from "src/integrations/tools-common/shapeTransformTools/Split/SplitTool"
import { useRef } from "preact/hooks"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"

type TransformAction = "union" | "intersect" | "subtract" | "offset" | "split"

export const lastShapeTransformToolState = atom<TransformAction>({
  key: "lastShapeTransformToolState",
  default: "union",
})

const SPLIT_TOOL_ID = "split"
const splitToolCfg: ToolCfg = {
  id: SPLIT_TOOL_ID,
  tool: SplitTool,
  toolbar: "topLevel",
  propertyPanel: "default",
}

export default function ShapeTransformTool() {
  const [openMenu, setMenuOpen] = useState(false)

  const mouseOutTimeout = useRef<ReturnType<typeof setTimeout> | undefined>()
  const toolbarMouseLeave = useCallback(() => {
    mouseOutTimeout.current = setTimeout(() => setMenuOpen(false), 200)
  }, [])

  const toolbarMouseEnter = useCallback(() => {
    clearTimeout(mouseOutTimeout.current)
    setMenuOpen(true)
  }, [])

  const validBooleanSelection = selectionOnlyContainsPolygonsSignalFamily(2).value

  const [openOffsetDialog, setOpenOffsetDialog] = useState(false)
  const [lastAction, setLastAction] = useRecoilState(lastShapeTransformToolState)

  const { setShowPreview: setShowUnionPreview, execute: executeUnion } = useBooleanOperation(
    PolygonBoolean.union,
    true,
    "Union shapes",
  )

  const { setShowPreview: setShowSubtractPreview, execute: executeSubtract } = useBooleanOperation(
    PolygonBoolean.difference,
    false,
    "Subtract shapes",
  )

  const { setShowPreview: setShowIntersectPreview, execute: executeIntersect } = useBooleanOperation(
    PolygonBoolean.intersection,
    false,
    "Intersect shapes",
  )

  const onComplete = useCallback(
    (completedTransform: TransformAction) => {
      setLastAction(completedTransform)
      setMenuOpen(false)
      setShowUnionPreview(false)
      setShowSubtractPreview(false)
      setShowIntersectPreview(false)
      exitCurrentTool()
    },
    [setLastAction, setShowUnionPreview, setShowSubtractPreview, setShowIntersectPreview],
  )

  const LastActionIcon = useCallback(() => {
    switch (lastAction) {
      case "union":
        return <UnionIcon />
      case "intersect":
        return <IntersectIcon />
      case "subtract":
        return <SubtractIcon />
      case "offset":
        return <OffsetIcon />
      case SPLIT_TOOL_ID:
        return <SplitIconLarge />
      default:
        return <UnionIcon />
    }
  }, [lastAction])

  const executeLastAction = useCallback(() => {
    switch (lastAction) {
      case "union": {
        executeUnion()
        onComplete("union")
        break
      }
      case "intersect": {
        executeIntersect()
        onComplete("intersect")
        break
      }
      case "subtract": {
        executeSubtract()
        onComplete("subtract")
        break
      }
      case "offset": {
        setMenuOpen(true)
        setOpenOffsetDialog(true)
        break
      }
      case SPLIT_TOOL_ID: {
        toolAPI.setTool(splitToolCfg)
        break
      }
    }
  }, [executeIntersect, executeSubtract, executeUnion, lastAction, onComplete])

  return (
    <ToolbarButtonWithMenu
      label={() => ""}
      icon={<LastActionIcon />}
      active={lastAction === SPLIT_TOOL_ID && toolAPI.currentToolSignal.value.id === SPLIT_TOOL_ID}
      onMouseOver={toolbarMouseEnter}
      onMouseOut={toolbarMouseLeave}
      onClick={() => {
        executeLastAction()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: lastAction })
        Analytics.trackSelectTool("boolean", lastAction, "toolbar")
      }}
      menuTitle={(t) => t(($) => $.transform.title)}
      openMenu={openMenu}
      menuContent={
        <>
          <ToolbarButtonInMenu
            disabled={!validBooleanSelection}
            icon={<UnionIcon />}
            onClick={() => {
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: "union" })
              Analytics.trackSelectTool("boolean", "union", "toolbar")
              executeUnion()
              onComplete("union")
            }}
            label={(t) => t(($) => $.transform.union.name)}
            onMouseOver={() => setShowUnionPreview(validBooleanSelection && true)}
            onMouseOut={() => setShowUnionPreview(false)}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.union.name),
              bodyText: (t) => t(($) => $.transform.union.tooltip),
              icon: <img src={UnionGif} alt="loading..." loading="lazy" height="102" width="188" />,
              helpUrl: helpLinkDrawInDesignMode + "#h_9e50c104bc",
            }}
          />
          <ToolbarButtonInMenu
            icon={<SubtractIcon />}
            disabled={!validBooleanSelection}
            onClick={() => {
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: "subtract" })
              Analytics.trackSelectTool("boolean", "subtract", "toolbar")
              executeSubtract()
              onComplete("subtract")
            }}
            label={(t) => t(($) => $.transform.subtract.name)}
            onMouseOver={() => setShowSubtractPreview(validBooleanSelection && true)}
            onMouseOut={() => setShowSubtractPreview(false)}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.subtract.name),
              bodyText: (t) => t(($) => $.transform.subtract.tooltip),
              icon: <img src={SubtractGif} alt="loading..." loading="lazy" height="102" width="188" />,
              helpUrl: helpLinkDrawInDesignMode + "#h_9e50c104bc",
            }}
          />
          <ToolbarButtonInMenu
            icon={<IntersectIcon />}
            disabled={!validBooleanSelection}
            onClick={() => {
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: "intersect" })
              Analytics.trackSelectTool("boolean", "intersect", "toolbar")
              executeIntersect()
              onComplete("intersect")
            }}
            label={(t) => t(($) => $.transform.intersect.name)}
            onMouseOver={() => setShowIntersectPreview(validBooleanSelection && true)}
            onMouseOut={() => setShowIntersectPreview(false)}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.intersect.name),
              bodyText: (t) => t(($) => $.transform.intersect.tooltip),
              icon: <img src={IntersectGif} alt="loading..." loading="lazy" height="102" width="188" />,
              helpUrl: helpLinkDrawInDesignMode + "#h_9e50c104bc",
            }}
          />
          <OffsetButton setOpen={setOpenOffsetDialog} open={openOffsetDialog} onComplete={() => onComplete("offset")} />
          <ToolbarButtonInMenu
            icon={<SplitIconLarge />}
            label={(t) => t(($) => $.transform.split.name)}
            onClick={() => {
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: "split" })
              Analytics.trackSelectTool("boolean", "split", "toolbar")
              toolAPI.setTool(splitToolCfg)
              setLastAction(SPLIT_TOOL_ID)
            }}
            active={toolAPI.currentToolSignal.value.id === SPLIT_TOOL_ID}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.split.name),
              bodyText: (t) => t(($) => $.transform.split.tooltip),
              icon: <img src={SplitGif} alt="loading..." loading="lazy" height="102" width="188" />,
              helpUrl: helpLinkDrawInDesignMode + "#h_9e50c104bc",
            }}
          />
        </>
      }
    />
  )
}
