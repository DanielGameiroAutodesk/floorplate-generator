import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { useRef } from "preact/hooks"
import InputWithIcon from "src/integrations/InputWithIcon/InputWithIcon"
import { useOffset } from "./useOffset"
import { selectedTopLevelNodesSignal } from "src/core/selection/selectionState"
import { useTransformPolygonsPreview } from "src/integrations/tools-common/shapeTransformTools/polygonTransformFunctions"
import { selectionOnlyContainsPolygonsSignalFamily } from "src/integrations/tools-common/shapeTransformTools/shapeTransformTools.state"
import { ToolbarButtonInMenu } from "src/integrations/toolbar/ToolbarButton/ToolbarButtonWithMenu"
import OffsetGif from "./Offset_tooltip.gif"
import { helpLinkDrawInDesignMode } from "src/lib/helpLinks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { AnalyticsLegacy, AnalyticsTools, AnalyticsUtils, Analytics } from "src/core/analytics"
import OffsetIcon from "src/integrations/Toolbars/CoreToolbar/domain/shapeTransform/icons/OffsetIcon"
import { useTranslator } from "src/i18n"

export default function OffsetButton({
  open,
  setOpen,
  onComplete,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  onComplete: () => void
}) {
  const t = useTranslator()
  const inputDivRef = useRef<HTMLInputElement | null>(null)

  const popout = useRef<HTMLElement>(null)
  const [offsetRadius, setOffsetRadius] = useState(0)

  const selectedTopLevelNodes = selectedTopLevelNodesSignal.value
  const onlyPolygons = selectionOnlyContainsPolygonsSignalFamily(1).value

  const offset = useOffset(offsetRadius)
  const setShowPreview = useTransformPolygonsPreview(offset)

  const validSelection = useMemo(() => {
    return onlyPolygons && selectedTopLevelNodes.length === 1
  }, [onlyPolygons, selectedTopLevelNodes.length])

  const close = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  useEffect(() => {
    const element = popout.current

    element?.addEventListener("weave-menu-container-close", close)
    return () => {
      element?.removeEventListener("weave-menu-container-close", close)
    }
  }, [close, popout])

  useEffect(() => {
    if (open) {
      inputDivRef?.current?.getElementsByTagName("input")[0]?.select()
    }
  }, [open])

  const actionApi = useActionAPI()
  const execute = useCallback(() => {
    setShowPreview(false)
    setOpen(false)
    let categories = selectedTopLevelNodes.map((node) => node.elementContainer.mappedCategory)
    if (!validSelection) return
    const { actions } = offset()
    let trackingData = {
      elementCategory: AnalyticsUtils.trackedElementCategory(categories),
      tool: "offset",
      numElements: selectedTopLevelNodes.length,
      eventType: "update",
    }

    actionApi.apply("Offset shapes", actions, trackingData)
    onComplete()
  }, [setShowPreview, selectedTopLevelNodes, setOpen, validSelection, offset, onComplete, actionApi])

  const openDialog = useCallback(() => {
    if (!validSelection) return
    setOffsetRadius(0)
    setOpen(!open)
  }, [open, setOpen, validSelection])

  useEffect(() => {
    if (validSelection) {
      setShowPreview(open)
    }
  }, [open, setShowPreview, validSelection])

  const valid = useMemo(() => {
    return open && offset().isValid
  }, [open, offset])

  return (
    <>
      <ToolbarButtonInMenu
        icon={<OffsetIcon />}
        label={(t) => t(($) => $.transform.offset.name)}
        onClick={() => {
          openDialog()
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.BooleanOperation, "toolbar", { operation: "offset" })
          Analytics.trackSelectTool("boolean", "offset", "toolbar")
        }}
        active={open}
        disabled={!validSelection}
        expandedTooltip={
          !open && validSelection
            ? {
                title: (t) => t(($) => $.transform.offset.name),
                bodyText: (t) => t(($) => $.transform.offset.tooltip),
                icon: <img src={OffsetGif} alt="loading..." loading="lazy" height="102" width="188" />,
                helpUrl: helpLinkDrawInDesignMode,
              }
            : undefined
        }
      />
      <weave-menu-container ref={popout} title={t(($) => $.transform.offset.name)} right={0} top={-30} open={open}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            execute()
          }}
          noValidate={true}
        >
          <div style={{ paddingBottom: "1rem" }} ref={inputDivRef}>
            <InputWithIcon
              id={"offsetInput"}
              icon={<OffsetIcon />}
              label={t(($) => $.transform.offset.name)}
              unit={"length"}
              value={offsetRadius}
              onChange={(value) => setOffsetRadius(value)}
            />
          </div>
          <weave-button
            type="submit"
            variant="solid"
            onClick={(e) => {
              e.stopPropagation()
              execute()
            }}
            disabled={!valid}
          >
            {t(($) => $.transform.offset.apply)}
          </weave-button>
          {!valid && <div>{t(($) => $.errors.import.resultingShapeInvalid)}</div>}
        </form>
      </weave-menu-container>
    </>
  )
}
