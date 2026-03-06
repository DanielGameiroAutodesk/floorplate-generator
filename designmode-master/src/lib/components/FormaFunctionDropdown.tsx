import { useEffect, useRef } from "preact/hooks"
import useLazyLoadScript from "src/lib/useLazyLoadScript"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-function-dropdown": JSX.HTMLAttributes<HTMLElement>
    }
  }
}

export type UnitFunction = {
  functionId?: string
  functionName?: string
}

export function FormaFunctionDropdown({
  canEdit,
  projectId,
  setBuildingFunction,
  selectedBuildingFunctions,
  showDotsOnly = false,
  functionsType = "building",
}: {
  canEdit: boolean
  projectId: string
  setBuildingFunction: (functionId: UnitFunction) => void
  selectedBuildingFunctions: UnitFunction[]
  showDotsOnly?: boolean
  functionsType?: "building" | "surface"
}) {
  const ref = useRef<HTMLElement & any>(null)
  useLazyLoadScript("/web-components/key-figures-v2/key-figures-v2.js", "building-systems")

  useEffect(() => {
    if (!ref.current) return
    const functionDropdown = ref.current!
    functionDropdown.hasEditAccess = canEdit
    functionDropdown.projectId = projectId
    functionDropdown.setFunction = setBuildingFunction
    functionDropdown.selectedFunctions = selectedBuildingFunctions
    functionDropdown.showDotsOnly = showDotsOnly
    functionDropdown.functionsType = functionsType
  }, [canEdit, functionsType, projectId, selectedBuildingFunctions, setBuildingFunction, showDotsOnly])

  return <forma-function-dropdown ref={ref} />
}
