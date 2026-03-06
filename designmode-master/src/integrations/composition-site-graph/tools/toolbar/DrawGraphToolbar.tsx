import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import type { CompleteCallbackGraph } from "src/integrations/composition-site-graph/tools/DrawGraph"
import { drawGraphToolState, useExitGraphTool } from "src/integrations/composition-site-graph/tools/DrawGraph"
import { useRecoilState } from "recoil"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

export default function DrawGraphToolbar({
  graphToolStateId,
  onComplete,
  onCancel,
}: {
  graphToolStateId: string
  onComplete: CompleteCallbackGraph
  onCancel: () => void
}) {
  const exitDrawGraph = useExitGraphTool(onComplete, onCancel, graphToolStateId)
  const [toolState, setToolState] = useRecoilState(drawGraphToolState)
  return (
    <>
      <ToolbarButton
        icon={<span>E</span>}
        onClick={() => setToolState("edge")}
        label={(t) => t(($) => $.composition.graph.edgeButton)}
        active={toolState === "edge"}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={exitDrawGraph} />
    </>
  )
}
