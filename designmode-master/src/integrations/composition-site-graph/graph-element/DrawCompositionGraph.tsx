import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { useCallback } from "react"
import sceneManager from "src/core/three/sceneManager"
import { useEffect, useMemo, useState } from "preact/hooks"
import { GraphMesh } from "src/integrations/composition-site-graph/tools/GraphMesh"
import graph from "src/integrations/composition-site-graph/graph/graph"
import type { RowHouseGraph } from "src/integrations/composition-site-graph/state"
import { DrawGraph } from "src/integrations/composition-site-graph/tools/DrawGraph"
import Composition from "./composition"
import { useSetRecoilState } from "recoil"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import { Matrix4 } from "three"
import { signal } from "@preact/signals"
import type { LineSettings } from "./types"
import { DEFAULT_LINE_SETTINGS } from "./types"
import { AnalyticsLegacy } from "src/core/analytics"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import { addRowHousePropertiesToSide } from "./housingGraph"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import type { I18nStringProvider } from "src/i18n"
import { exitCurrentTool } from "src/core/toolsState"
import { EventName } from "@spacemakerai/webapp-analytics"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const newRowHouseLineSettingsSignal = signal<LineSettings>(DEFAULT_LINE_SETTINGS)

export function DrawCompositionGraph() {
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()
  const currentTemplate = CurrentTemplate.templateSignal.value
  const lineSettings = newRowHouseLineSettingsSignal.value
  const [latestGraph, setLatestGraph] = useState(undefined as RowHouseGraph | undefined)
  const renderAPI = useRenderAPI("DrawCompositionGraph")

  const graphMesh = useMemo(() => {
    return new GraphMesh(graph.empty(), terrain.elevationAt, new Matrix4())
  }, [terrain.elevationAt])

  useEffect(() => {
    //TODO: Move to handler, do not track inside a component
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Tool_LineStart)
  }, [])

  renderAPI.useObjectLifecycle_TEMPORARY_FIX(graphMesh)

  const onComplete = useCallback(
    (g: RowHouseGraph, currentTemplate: ParcelTemplate) => {
      AnalyticsLegacy.track(CompositionEventNames.Tool_LineComplete)
      const graphWithRowhouses = addRowHousePropertiesToSide(g, currentTemplate, lineSettings)
      const result = Composition.create(graphWithRowhouses, currentTemplate, terrain.elevationAt)
      const actions = actionAPI.add.subTree_UNSTABLE(result.rootUrn, result.elements, new Set(), result.representations)

      actionAPI.apply("Add row houses from line tool", actions)
      actionAPI.resetPreview_UNSTABLE()
      exitCurrentTool()
      dispatchBuildingEvent("row_house", EventName.Add, "draw", { sub_feature: "row_house_line", shape_type: "line" })
      newRowHouseLineSettingsSignal.value = DEFAULT_LINE_SETTINGS
    },
    [lineSettings, terrain.elevationAt, actionAPI],
  )

  const onPreview = useCallback(
    (g: RowHouseGraph, currentTemplate: ParcelTemplate, lineSettings: LineSettings) => {
      setLatestGraph(g)
      const graphWithRowhouses = addRowHousePropertiesToSide(g, currentTemplate, lineSettings)
      const result = Composition.create(graphWithRowhouses, currentTemplate, terrain.elevationAt)
      const actions = actionAPI.add.subTree_UNSTABLE(result.rootUrn, result.elements, new Set(), result.representations)

      actionAPI.preview_UNSTABLE(actions)
      graphMesh.update(g)
      sceneManager.render(false, true)
    },
    [setLatestGraph, actionAPI, terrain.elevationAt, graphMesh],
  )

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.guideText.switchHousePlacementSide))
    return () => setGuideText(() => () => "")
  }, [setGuideText])

  const switchPlacementSide = useCallback(() => {
    const nextPlacementSide = lineSettings.placementSide == "left" ? "right" : "left"
    const newLineSettings = {
      ...lineSettings,
      placementSide: nextPlacementSide,
    } as const
    newRowHouseLineSettingsSignal.value = newLineSettings
    if (!latestGraph || !currentTemplate) {
      return
    }
    onPreview(latestGraph, currentTemplate, newLineSettings)
  }, [lineSettings, latestGraph, currentTemplate, onPreview])

  const switchPlacementHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.switchHousePlacementSide),
      keyCode: "Tab",
      editAccessRequired: true,
      callback: switchPlacementSide,
    }
  }, [switchPlacementSide])

  useHotkey(switchPlacementHotkey)

  const onCancel = useCallback(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Tool_LineCancel)
    sceneManager.render(false, true)
    actionAPI.resetPreview_UNSTABLE()
    exitCurrentTool()
    newRowHouseLineSettingsSignal.value = DEFAULT_LINE_SETTINGS
  }, [actionAPI])

  if (!currentTemplate) return null
  return (
    <DrawGraph
      graphToolStateId={"rowhouseTool"}
      onComplete={(g) => onComplete(g, currentTemplate)}
      onPreview={(g) => onPreview(g, currentTemplate, lineSettings)}
      onCancel={onCancel}
    />
  )
}
