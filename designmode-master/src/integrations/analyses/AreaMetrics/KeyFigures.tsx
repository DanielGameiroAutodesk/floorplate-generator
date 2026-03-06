import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import menuStyles from "src/integrations/analyses/Triggers/Triggers.module.pcss"
import { Analytics, APPNAME } from "src/core/analytics"
import type { ElementGrossFloorAreas } from "./GrossFloorAreas"
import { GrossFloorAreas } from "./GrossFloorAreas"
import analyseHeaderStyles from "src/integrations/analyses/AnalysisMenu/AnalysisMenu.module.pcss"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import type { InternalPath } from "src/lib/element/path"
import type { FormaElement, MultiRingPolygon, Urn } from "@spacemakerai/element-types"
import { elementState } from "src/core/elements/ElementState"
import { useComputed, useSignal } from "@preact/signals"
import { PROJECT_ID } from "src/core/project/project"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { SELECTED_FOR_ANALYSIS_COLOR } from "src/integrations/analyses/Triggers/constants"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { selectedPathsInCurrentProposalAsArraySignal } from "src/core/selection/selectionState"
import type { Surface } from "src/integrations/area-stats/surface"
import type { Feature, Polygon } from "geojson"
import { explicitSignalWithReset, useReadonlySignal } from "src/lib/signal"
import { RenderSurfaces, type SurfacesToVisualize } from "src/core/three/stencil/RenderSurfaces"
import { useRecoilValue } from "recoil"
import { activeSelectableAreasState } from "src/integrations/analyses/Selection/analysis-selection-state"
import { transformMultiRingPolygon } from "src/integrations/area-stats/polygon-helpers"
import { useDrawSiteLimit } from "src/integrations/basic-elements/draw/Limits/LimitsToolbar"
import type { ComponentChildren } from "preact"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import { createSetBasicBuildingTool } from "src/integrations/Toolbars/CoreToolbar/domain/building/BuildingToolbar"

type SurfaceToKeyFiguresWC = {
  polygon: MultiRingPolygon
  functions: { id: string }[]
  horizontalProjection: { type: "onGround" } | { type: "atElevation"; elevation: number }
}

type HTMLFormaKeyFiguresElementProps = {
  app: string
  projectId: string
  selected: (InternalPath | Urn)[]
  hasEditAccess: boolean
  imperial: boolean
  rootUrnWithElementFetcher: {
    rootUrn: Urn
    getElement: (urn: Urn) => FormaElement | undefined
  }
  getGeoJson: (urn: Urn) => Feature | undefined
  getSurfaces: (relevantElementPaths: InternalPath[]) => SurfaceToKeyFiguresWC[]
  setHighlightedSurfaces: (
    items: {
      polygons: MultiRingPolygon[]
      color: string
    }[],
  ) => void
  analysisAreas: MultiRingPolygon[]

  // These are set as optional as we cannot set them using preact.
  // (Preact would try to add it as event listener since the name starts with "on").
  onHoverHousingMetricStart?: (paths: string[]) => void
  onHoverHousingMetricEnd?: (paths: string[]) => void
  onHoverMetricStart?: (elementsGfas: ElementGrossFloorAreas[]) => void
  onHoverMetricEnd?: () => void
  onDrawSiteLimit?: () => void
  onDrawBasicBuilding?: () => void
  preactChildren?: ComponentChildren
  emptyStateFeatureFlag?: boolean
}

type HTMLFormaKeyFiguresElement = HTMLElement & HTMLFormaKeyFiguresElementProps

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-key-figures": Omit<JSX.HTMLAttributes<HTMLFormaKeyFiguresElement>, "selected"> &
        HTMLFormaKeyFiguresElementProps
    }
  }
}

/**
 * Used to select subpaths not covered by toplevel selection in designmode
 */
export const [keyFiguresSelectionOverrideSignal, setKeyFiguresSelectionOverride, resetKeyFiguresSelectionOverride] =
  explicitSignalWithReset<Set<InternalPath> | undefined>(undefined)

const compareMode = new URLSearchParams(window.location.search).has("compare")

export function KeyFigures({ imperial }: { imperial: boolean }) {
  const isLoaded = useLazyLoadScript("/web-components/key-figures-v2/key-figures-v2.js", "design-mode")

  const [gfaToInspect, setGfaToInspect] = useState<ElementGrossFloorAreas[] | undefined>()
  const [hoveredPaths, setHoveredPaths] = useState<InternalPath[]>([])
  const highlightedSurfacesSignal = useSignal<SurfacesToVisualize[]>([])
  const { selectedElementPaths } = useSelectedElementPaths()
  const selectedElementPathsSignal = useReadonlySignal(selectedElementPaths)
  const analysisBuildingColorApi = useAnalysisBuildingColorApi()

  const selectedSignal = useComputed(() =>
    keyFiguresSelectionOverrideSignal.value && keyFiguresSelectionOverrideSignal.value.size > 0
      ? [...keyFiguresSelectionOverrideSignal.value]
      : selectedPathsInCurrentProposalAsArraySignal.value.length
        ? selectedPathsInCurrentProposalAsArraySignal.value
        : selectedElementPathsSignal.value,
  )

  const getElementSignal = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    return (urn: Urn) => snapshot.getFormaElement(urn)
  })

  const getFootprintSignal = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    return (urn: Urn) => snapshot.getElementContainer(urn)?.representations.footprint
  })

  const getSurfacesSignal = useComputed(() => {
    const proposal = elementState.currentProposalSignal.value
    return (relevantElements: InternalPath[]): Surface[] =>
      proposal
        .getToplevelNodes()
        .filter((node) => relevantElements.some((relevantPath) => node.path.startsWith(relevantPath)))
        .flatMap((node) => node.areaStatsSurfaces.getOrCompute())
  })

  const setHighlightedSurfaces = useCallback(
    (items: SurfacesToVisualize[]) => {
      highlightedSurfacesSignal.value = items
    },
    [highlightedSurfacesSignal],
  )

  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(elementState.currentProposalIdSignal.value))
  const proposal = elementState.currentProposalSignal.value

  const analysisAreas = useMemo(() => {
    const result: MultiRingPolygon[] = []

    for (const path of activeSelectableAreas) {
      const node = proposal.snapshot.getNode(path)
      if (!node) continue

      const footprint = node.elementContainer.representations.footprint
      if (!footprint) return []

      if (isPolygonFeature(footprint)) {
        result.push(transformMultiRingPolygon(getGeometryCoordinates(footprint.geometry), node.globalMatrix))
      }
    }

    return result
  }, [activeSelectableAreas, proposal])

  const drawSiteLimit = useDrawSiteLimit({ siteLimitEnabled: true })
  const drawBasicBuilding = createSetBasicBuildingTool("area_metrics")

  const handleMount = useCallback(
    (el: HTMLFormaKeyFiguresElement | null) => {
      if (!el) return

      // Since the following properties start with "on" we cannot pass them as regular
      // props in JSX, as Preact would try to add them as event listeners.

      el.onHoverMetricStart = (elementsGrossFloorAreas: ElementGrossFloorAreas[]) => {
        setGfaToInspect(elementsGrossFloorAreas)
      }
      el.onHoverHousingMetricStart = (paths: string[]) => {
        setHoveredPaths(paths)
      }
      el.onHoverHousingMetricEnd = () => {
        setHoveredPaths([])
      }
      el.onHoverMetricEnd = () => {
        setGfaToInspect(undefined)
      }
      el.onDrawSiteLimit = () => {
        drawSiteLimit()
        Analytics.trackSelectTool("draw", "polygon", "area_metrics", "site_limit")
      }
      el.onDrawBasicBuilding = () => {
        drawBasicBuilding()
      }
    },
    [drawSiteLimit, drawBasicBuilding],
  )

  useEffect(() => {
    const colorPaths = colorMapAllPaths(hoveredPaths, SELECTED_FOR_ANALYSIS_COLOR)
    analysisBuildingColorApi.setBuildingColors(colorPaths)
    return () => analysisBuildingColorApi.clearBuildingColors()
  }, [hoveredPaths, analysisBuildingColorApi])

  const rootUrnWithElementFetcherSignal = useComputed(() => ({
    rootUrn: elementState.currentProposalSignal.value.urn,
    getElement: getElementSignal.value,
  }))

  if (!isLoaded) {
    return null
  }

  let className
  if (!compareMode) {
    className = menuStyles.Panel
  }

  return (
    <>
      <GrossFloorAreas gfaToInspect={gfaToInspect} />
      <RenderSurfaces surfacesSignal={highlightedSurfacesSignal} />

      <div className={className}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <forma-key-figures
            ref={handleMount}
            projectId={PROJECT_ID}
            getGeoJson={getFootprintSignal.value}
            rootUrnWithElementFetcher={rootUrnWithElementFetcherSignal.value}
            selected={selectedSignal.value}
            hasEditAccess={canEditProposalSignal.value}
            app={APPNAME}
            getSurfaces={getSurfacesSignal.value}
            setHighlightedSurfaces={setHighlightedSurfaces}
            analysisAreas={analysisAreas}
            imperial={imperial}
          >
            <div className={analyseHeaderStyles.AnalyzeHeader}>
              Analysis area
              <Selection analysisType={"area-metrics"} />
            </div>
          </forma-key-figures>
        </div>
      </div>
    </>
  )
}

function colorMapAllPaths(paths: string[], color: string) {
  return Object.fromEntries(paths.map((path) => [path, color]))
}

function isPolygonFeature(f: Feature): f is Feature<Polygon> {
  return f.geometry.type === "Polygon"
}

function getGeometryCoordinates(polygon: Polygon): MultiRingPolygon {
  return polygon.coordinates as MultiRingPolygon
}
