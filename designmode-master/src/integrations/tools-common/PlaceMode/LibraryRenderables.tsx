import { useMemo } from "preact/compat"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { useRecoilValue } from "recoil"
import { libraryElementsState } from "./library"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { selectedLibraryElementsState } from "./PlaceModeGeorefTool"
import type { Renderable } from "src/integrations/renderables/renderable"
import { RenderingSpecs } from "src/integrations/renderables/renderable"
import { isDefined } from "src/lib/array"

export function LibraryRenderables() {
  const group3d = useMemo(() => new RenderGroup("contextual-renderables-3d"), [])
  const group2d = useMemo(() => new RenderGroup("contextual-renderables-2d"), [])

  const libraryElements = useRecoilValue(libraryElementsState)

  const selectedIds = useRecoilValue(selectedLibraryElementsState)

  useMemo(() => {
    const renderables3d: Renderable[] =
      libraryElements?.toplevel
        .flatMap((info) => info.geometry.renderables3d)
        .filter(isDefined)
        .map(
          (r): Renderable =>
            selectedIds.has(r.id) && RenderingSpecs[r.spec].material.placeModeSelected
              ? { ...r, mode: "placeModeSelected" }
              : RenderingSpecs[r.spec].material.placeMode
                ? { ...r, mode: "placeMode" }
                : r,
        ) ?? []

    group3d.update(renderables3d)

    const renderables2d: Renderable[] =
      libraryElements?.toplevel
        .flatMap((info) => info.geometry.renderables2d)
        .filter(isDefined)
        .map(
          (r): Renderable =>
            selectedIds.has(r.id) && RenderingSpecs[r.spec].material.placeModeSelected
              ? { ...r, mode: "placeModeSelected" }
              : RenderingSpecs[r.spec].material.placeMode
                ? { ...r, mode: "placeMode" }
                : r,
        ) ?? []

    group2d.update(renderables2d)

    sceneManager.render(true, true)
  }, [group2d, group3d, libraryElements, selectedIds])

  useObjectLifecycle(group3d)
  useObjectLifecycle(group2d, true, sceneManager.overlay.scene)

  return null
}
