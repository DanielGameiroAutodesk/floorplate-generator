import { useEffect } from "preact/hooks"
import { updateElementPropertyPreset } from "src/integrations/basic-elements/basicElementPresets"
import { defaultTreeAreaConfig, defaultTreeLineConfig } from "src/integrations/basic-elements/trees/defaults"
import { useIsImperial } from "src/lib/unitSettings"

export function useUpdatePropertyElementPresets() {
  const imperialUnits = useIsImperial()

  useEffect(() => {
    if (imperialUnits) {
      updateElementPropertyPreset({
        presetName: "tree_area",
        presetProperty: "treePlacerGenerator",
        value: { id: "treePlacerGenerator", ...defaultTreeAreaConfig(imperialUnits) },
      })
      updateElementPropertyPreset({
        presetName: "tree_line",
        presetProperty: "treeLineGenerator",
        value: { id: "treeLineGenerator", ...defaultTreeLineConfig(imperialUnits) },
      })
    }
  }, [imperialUnits])
}
