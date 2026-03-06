import { Colorbar } from "./Colorbar"
import { activeColorbarRenderScopeSignal, colorbarDefinitionSignalFamily } from "./ColorbarAPI"
import { useSetSignal } from "src/lib/signal"

export const AnalysisColorbar = () => {
  const activeColorbarRenderScope = activeColorbarRenderScopeSignal.value
  const colorbarDefinitionSignal = colorbarDefinitionSignalFamily(activeColorbarRenderScope)
  const colorbarDefinition = colorbarDefinitionSignal.value

  const setColorbarDefinition = useSetSignal(colorbarDefinitionSignal)

  if (!colorbarDefinition || colorbarDefinition.colors.length === 0) return null

  return (
    <Colorbar
      colorbarDefinition={colorbarDefinition}
      setColorbarDefinition={setColorbarDefinition}
      activeRenderScope={activeColorbarRenderScope}
    />
  )
}
