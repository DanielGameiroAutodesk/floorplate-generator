import { useRecoilValue } from "recoil"
import type { LibraryElementData } from "./library"
import { libraryElementsState } from "./library"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { useCallback, useMemo } from "preact/compat"
import { isDefined } from "src/lib/array"
import type { ToolState } from "src/integrations/tools-common/AffineTooling/Affine"
import { Affine } from "src/integrations/tools-common/AffineTooling/Affine"
import { Box3, Matrix4, Vector3 } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import sceneManager from "src/core/three/sceneManager"
import type { Child, Urn } from "@spacemakerai/element-types"
import { contextRootSignal, setSelectionSetSignalValue } from "src/core/selection/selectionState"
import { useExitPlaceMode } from "./resourcesHooks"
import type { Action } from "src/core/legacy-actions"
import type { Category } from "src/core/categories"
import { showCategory } from "src/core/categories"
import { getTranslator } from "src/i18n"
import type { InternalPath } from "src/lib/element/path"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { newChildKey, newId } from "src/lib/element/urn"
import { AnalyticsUtils, Analytics } from "src/core/analytics"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCalculateAffineSnap } from "src/integrations/snapping/useAffineSnap"
import { useAsyncMemo } from "src/lib/hooks"
import { representationsByUrnToKnownRepresentations } from "src/core/elements/ElementRepresentations"
import { batch } from "@preact/signals"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

const group3d = new RenderGroup("drag-drop-renderables-3d")
const group2d = new RenderGroup("drag-drop-renderables-2d")

export default function PlaceModeAffineTool() {
  const libraryElement = useRecoilValue(libraryElementsState)

  return libraryElement ? <PlaceManuallyFromLibraryyToolInner libraryElement={libraryElement} /> : null
}

function PlaceManuallyFromLibraryyToolInner({ libraryElement }: { libraryElement: LibraryElementData }) {
  const calculateAffineSnap = useCalculateAffineSnap()

  const centerTranslate3D = useMemo(() => {
    const bbox = new Box3()
    const renderables3d = libraryElement.toplevel.flatMap((toplevel) => {
      return toplevel.geometry.renderables3d || []
    })
    renderables3d.forEach((r) => {
      if (!r.geometry.boundingBox) {
        r.geometry.computeBoundingBox()
      }
      bbox.union(r.geometry.boundingBox!)
    })
    const center = bbox.getCenter(new Vector3())
    return center
  }, [libraryElement.toplevel])

  const is3d = useMemo(() => {
    return libraryElement.toplevel.every((tl) => tl.geometry.renderables3d)
  }, [libraryElement.toplevel])

  useMemo(() => {
    // Need to reset matrix as Affine tool mutates this
    group3d.position.set(0, 0, 0)
    group3d.updateMatrix()
    group2d.position.set(0, 0, 0)
    group2d.updateMatrix()
    group3d.update(libraryElement.toplevel.flatMap((tl) => tl.geometry.renderables3d).filter(isDefined))
    group2d.update(libraryElement.toplevel.flatMap((tl) => tl.geometry.renderables2d))
  }, [libraryElement])

  useObjectLifecycle(group3d, true)
  useObjectLifecycle(group2d, true, sceneManager.overlay.scene)

  const initialState: ToolState = useMemo(() => {
    return {
      type: "move",
      origin: is3d ? centerTranslate3D : new Vector3(),
      isOriginInsideTerrain: true,
      target: newId(),
      mouseDownPos: [0, 0],
      active: true,
      moveMode: "terrain",
    }
  }, [centerTranslate3D, is3d])

  const contextRoot = contextRootSignal.value
  const exitPlaceMode = useExitPlaceMode()

  const actionAPI = useActionAPI()

  const apply = useCallback(
    (matrix: Matrix4) => {
      let actions: Action<"add">[] = []

      function addAction(urn: Urn, parentPath: InternalPath, child: Omit<Child, "urn">) {
        if (!libraryElement) return
        const element = libraryElement.state.elements.getOrThrow(urn)
        actions.push({
          type: "add",
          element,
          parentPath,
          child: { ...child, name: libraryElement.name },
          representations: representationsByUrnToKnownRepresentations(libraryElement.state.representations, urn),
          persisted: true,
        })

        const path = mergePath(parentPath, child.key)
        for (const child of element.children ?? []) {
          const { urn, ..._child } = child
          addAction(urn, path, _child)
        }
      }

      const keys: string[] = []
      for (let { urn, worldTransform } of libraryElement.toplevel) {
        const key = newChildKey()
        keys.push(key)
        const transform = matrix
          .clone()
          .premultiply(worldTransform ?? new Matrix4())
          .toArray()

        addAction(urn, contextRoot, { key, transform: transform })
      }

      const categories: Category[] = libraryElement.toplevel.map((tl) => tl.category)
      categories.forEach((c) => showCategory(c, contextRoot !== ROOT_KEY))

      batch(() => {
        actionAPI.apply("Place mode (add)", actions, {
          tool: "placemode-manual",
          numElements: 1,
          eventType: "add",
          elementCategory: AnalyticsUtils.trackedElementCategory(categories),
          inScenario: contextRoot === ROOT_KEY ? "no" : "yes",
        })

        Analytics.track(
          EventName.Add,
          {
            feature_category: FeatureCategory.ContextualData,
            feature: "place_mode",
            sub_feature: "place_mode_affine",
            object_type: "element",
          },
          { category: AnalyticsUtils.trackedElementCategory(categories) },
        )

        const t = getTranslator()
        window.forma_toasts.push({
          status: "success",
          content: t(($) => $.messages.elementAddedTo, { location: contextRoot !== ROOT_KEY ? "base" : "proposal" }),
          autoDismiss: true,
        })

        setSelectionSetSignalValue(new Set(keys.map((key) => mergePath(contextRoot, key))))
        exitPlaceMode()
      })
    },
    [actionAPI, contextRoot, exitPlaceMode, libraryElement],
  )

  const targetSnapData = useAsyncMemo(calculateAffineSnap, [], 500)

  return (
    <Affine
      moveGroup2D={group2d}
      moveGroup3D={group3d}
      movingSnapData={libraryElement.toplevel.map((tl) => tl.geometry.snapping?.affineSnapInfo).filter(isDefined)}
      targetSnapData={targetSnapData}
      apply={apply}
      movingPaths={new Set()}
      initialState={initialState}
      showGuideText={false}
    />
  )
}
