import { memo, useEffect, useState } from "preact/compat"
import { StackBasedErrorBoundary } from "./FailableComponentWrapper/StackBasedErrorBoundary"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "sm-help-panel": {
        app: string
        "data-nextgen"?: any
        is3DSketch?: boolean
      }
    }
  }
}

const HelpPanelComponent = ({ is3dSketch }: { is3dSketch: boolean }) => {
  const [isMounted, setIsMounted] = useState<boolean>(false)

  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true)
    }, 1000)
  }, [])
  if (!isMounted) return null
  return (
    <StackBasedErrorBoundary stackPath={"help-panel"} className="forma-grid-help-panel" darkMode={true}>
      <sm-help-panel app="designmode" data-nextgen is3DSketch={is3dSketch} />
    </StackBasedErrorBoundary>
  )
}

export default memo(HelpPanelComponent)
