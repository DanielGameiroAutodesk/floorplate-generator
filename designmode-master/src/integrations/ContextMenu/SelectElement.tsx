import { useMemo } from "preact/hooks"
import type { Object3D } from "three"
import { raycastTargetsSignal } from "src/core/selection/raycast-targets"
import { mousePosition } from "src/core/useMousePosition"
import type { SelectionPath } from "src/core/selection/selectionTypes"
import { setHoveredSelectionPathsSignalValue, setSelectionPathsSignalValue } from "src/core/selection/selectionState"
import { useTranslator } from "src/i18n"

export const SelectTerrainPad = () => {
  const t = useTranslator()
  const raycasterOnMount = useMemo(() => mousePosition, [])

  const raycastTargets = raycastTargetsSignal.peek()
  const allIntersections = raycasterOnMount.intersectObjects(Array.from(raycastTargets.keys()), true)

  const uniqueSelectionPaths = useMemo(() => {
    const seen = new Set<string>()
    const results: { selection: SelectionPath; object: Object3D }[] = []

    for (const intersection of allIntersections) {
      const object = intersection.object
      const raycastData = raycastTargets.get(object)

      if (!raycastData) continue

      const key = raycastData.selection
      if (seen.has(key) || key.split(":")[1] !== "terrain_pads") continue

      seen.add(key)
      results.push({ selection: raycastData.selection, object })
    }

    return results
  }, [allIntersections, raycastTargets])

  const onMouseEnter = (selection: SelectionPath) => {
    setHoveredSelectionPathsSignalValue((prev) => {
      const newSet = new Set(prev)
      newSet.add(selection)
      return newSet
    })
  }

  const onMouseLeave = (selection: SelectionPath) => {
    setHoveredSelectionPathsSignalValue((prev) => {
      const newSet = new Set(prev)
      newSet.delete(selection)
      return newSet
    })
  }

  const onClick = (selection: SelectionPath) => {
    setSelectionPathsSignalValue(new Set([selection]))
  }

  if (uniqueSelectionPaths.length === 0) return null

  return (
    <>
      <forma-context-menu-sub-menu text={t(($) => $.terrain.padsHeader)}>
        {uniqueSelectionPaths.map(({ selection }, i) => (
          <forma-context-menu-item
            key={selection}
            text={`Terrain Pad ${i + 1}`}
            onClick={() => onClick(selection)}
            onMouseEnter={() => onMouseEnter(selection)}
            onMouseLeave={() => onMouseLeave(selection)}
          />
        ))}
      </forma-context-menu-sub-menu>
      <forma-context-menu-divider />
    </>
  )
}
