import { useRecoilValue } from "recoil"
import { rowhouseToolState } from "./toolState"
import { PlaceSingleRowHouseTool } from "./PlaceSingleRowHouseTool"
import { DrawCompositionGraph } from "src/integrations/composition-site-graph/graph-element/DrawCompositionGraph"
import { useEffect } from "preact/hooks"
import { AnalyticsLegacy } from "src/core/analytics"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import { setUpCreateDefaultTemplateEffect } from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { assertNever } from "src/lib/assertNever"

export default function RowhouseTools() {
  const rowhouseTool = useRecoilValue(rowhouseToolState)
  useEffect(() => {
    const cancelEffect = setUpCreateDefaultTemplateEffect()
    return cancelEffect
  }, [])

  useEffect(() => {
    //TODO: Move to handler, do not track inside a component
    AnalyticsLegacy.track(CompositionEventNames.Tool_Start)
    return () => {
      AnalyticsLegacy.track(CompositionEventNames.Tool_Exit)
    }
  }, [])

  switch (rowhouseTool) {
    case "line":
      return <DrawCompositionGraph />
    case "placeSingleRowHouse":
      return <PlaceSingleRowHouseTool />

    default:
      return assertNever(rowhouseTool)
  }
}
