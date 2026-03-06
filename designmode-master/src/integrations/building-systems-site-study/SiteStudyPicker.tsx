import styles from "./siteStudyStyles.module.pcss"
import { useRecoilValue } from "recoil"
import {
  onExitSiteStudyTool,
  resetSiteStudySolutionSignal,
  selectedSiteStudySignal,
  siteStudyInputPolygonAtom,
  siteStudySignal,
  siteStudySolutionSignal,
  SiteStudyState,
  useIsInSiteStudyTool,
  useSelectAndApplyElementActions,
  useSiteStudyToolParams,
} from "./SiteStudyToolState"
import { memo, useEffect, useState } from "preact/compat"
import {
  PolygonWithHoles,
  PolyLine,
} from "src/integrations/building-systems-line-buildings/LineBuildingMenu/FloorIcons/simpleSvgComponents"
import type { MutableRef } from "preact/hooks"
import { getTranslator } from "src/i18n"
import { useErrorBoundary, useMemo, useRef } from "preact/hooks"
import type { Coord2D } from "src/lib/geometry/geometryTypes"
import { getUnitNormalVectorXY, moveAlongVectorXY } from "src/integrations/building-systems-common/geometryHelpers"
import type { SiteStudy } from "./generator/siteStudySpec"
import type { SimpleGraph } from "./simpleGraph"
import type { Shape } from "src/lib/three/Shape/types"
import {
  alignPolygonWithDirection,
  alignPolygonXYWithDirection,
  ensurePolygonIsXY,
  getBoundingBoxOfPolygon,
} from "src/integrations/building-systems-common/geoHelpers"
import { useCallback } from "react"
import { captureException } from "@sentry/browser"

const PICKER_PADDING = 12

function useTurnOffNativeScroll(pickerRef: MutableRef<HTMLDivElement | null>, currentPage: number) {
  useEffect(() => {
    function listener() {
      pickerRef.current?.scrollTo({
        left: currentPage * (pickerRef.current.clientWidth - PICKER_PADDING),
      })
    }

    window.addEventListener("wheel", listener)
    return () => window.removeEventListener("wheel", listener)
  }, [currentPage, pickerRef])
}

function usePagination(pickerRef: MutableRef<HTMLDivElement | null>) {
  const [currentPage, setCurrentPage] = useState(0)
  useEffect(() => {
    pickerRef.current?.scrollTo({
      left: currentPage * (pickerRef.current.clientWidth - PICKER_PADDING),
      behavior: "smooth",
    })
  }, [currentPage, pickerRef])
  useTurnOffNativeScroll(pickerRef, currentPage)
  return [currentPage, setCurrentPage] as const
}

function usePickerDomElement() {
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const [pickerWidth, setPickerWidth] = useState(700)
  const resizeObserver = useMemo(() => {
    return new ResizeObserver((entries) => {
      const picker = entries[0]
      setPickerWidth(picker.borderBoxSize[0].inlineSize)
    })
  }, [])
  const setPickerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (pickerRef.current) {
        resizeObserver.unobserve(pickerRef.current)
      }
      pickerRef.current = node
      if (node) {
        resizeObserver.observe(node)
      }
    },
    [resizeObserver],
  )
  const pickerDomElement = useMemo(() => {
    return {
      ref: pickerRef,
      width: pickerWidth,
    }
  }, [pickerWidth])
  return { setPickerRef, pickerDomElement }
}

export default function SiteStudyPicker() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("Site study picker error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.siteStudy.failedToLoadPicker),
      status: "warning",
    })
    captureException(error, { tags: { owner: "squad-composition" }, extra: { errorInfo } })
    onExitSiteStudyTool()
  })
  if (error) {
    return null
  }
  return <SiteStudyPickerInner />
}

function SiteStudyPickerInner() {
  const isInSiteStudyTool = useIsInSiteStudyTool()
  const siteStudyState = siteStudySignal.value
  const studies = siteStudySolutionSignal.value.siteStudySolutions
  const siteStudyInputPolygon = useRecoilValue(siteStudyInputPolygonAtom)

  const siteStudyToolParams = useSiteStudyToolParams()
  const selectAndApplyElementActions = useSelectAndApplyElementActions()
  const selectedStudy = selectedSiteStudySignal.value
  const { setPickerRef, pickerDomElement } = usePickerDomElement()

  const studiesPerPage = useMemo(() => {
    const STUDY_WIDTH = 133
    return Math.floor(pickerDomElement.width / STUDY_WIDTH)
  }, [pickerDomElement.width])

  const [currentPage, setCurrentPage] = usePagination(pickerDomElement.ref)

  const numberOfPages = useMemo(() => {
    return Math.min(studiesPerPage !== 0 ? Math.floor(Object.values(studies).length / studiesPerPage) : 0, 8)
  }, [studies, studiesPerPage])

  useEffect(() => {
    if (!isInSiteStudyTool) {
      setCurrentPage(0)
      resetSiteStudySolutionSignal()
    }
  }, [isInSiteStudyTool, setCurrentPage])

  if (siteStudyState !== SiteStudyState.PickingStudy) {
    return null
  }

  if (Object.entries(studies).length === 0) return null

  return (
    <div
      style={{ pointerEvents: "auto", display: "flex", flexDirection: "row", justifyContent: "center", width: "100%" }}
    >
      <div className={styles.pickerContainer}>
        <div style={`--padding: ${PICKER_PADDING}px`} className={styles.picker} ref={setPickerRef}>
          {Object.values(studies).map((study) => {
            if (study.status === "FINISHED") {
              return (
                <>
                  <div
                    key={`study-${study.id}`}
                    className={`${styles.study}`}
                    onClick={() => {
                      if (study.siteStudy) {
                        const { success } = selectAndApplyElementActions(study.siteStudy, siteStudyToolParams)
                        if (!success) {
                          console.error("Error selecting site study")
                          console.warn("site study:")
                          console.warn(JSON.stringify(study.siteStudy))
                          console.warn("site study params:")
                          console.warn(JSON.stringify(siteStudyToolParams))
                          captureException(new Error("Failure to select study directly affected user"), {
                            tags: { owner: "squad-composition" },
                          })
                          window.forma_toasts.push({
                            content: "Failed to select study. Sorry about that. Try to pick another one!",
                            status: "error",
                          })
                        }
                      }
                    }}
                  >
                    <SiteStudyThumbnail
                      siteStudy={study.siteStudy}
                      roads={siteStudyToolParams.roads}
                      trees={siteStudyToolParams.trees.enabled}
                      selected={selectedStudy?.study.id === study.siteStudy.id}
                      streetWidth={siteStudyToolParams.streetWidth || 3}
                    />
                  </div>
                </>
              )
            }

            if (!siteStudyInputPolygon) return null

            return (
              <>
                <div className={`${styles.study}`} key={`study-${study.id}`}>
                  <LoadingSiteThumbnail studyPolygon={siteStudyInputPolygon.shape} />
                </div>
              </>
            )
          })}
        </div>
        <div className={styles.pages}>
          {[...Array(numberOfPages).keys()].map((pageIdx) => {
            return (
              <div
                key={"pageSelect" + pageIdx}
                className={`${styles.pageSelector} ${pageIdx === currentPage ? styles.selectedPage : ""}`}
                onClick={() => setCurrentPage(pageIdx)}
              ></div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type PolygonXY = { x: number; y: number }[]

function calculateCenterPointAndScaleFromSite(
  sitePolygon: PolygonXY,
  viewBoxWidth: number,
  viewBoxHeight: number,
  padding: number,
) {
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygon(sitePolygon)
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerPoint = { x: centerX, y: centerY }
  const xLength = maxX - minX
  const yLength = maxY - minY

  let scaleX = (viewBoxWidth - padding) / xLength
  let scaleY = (viewBoxHeight - padding) / yLength

  const scale = Math.min(scaleX, scaleY)

  return { centerPoint, scale, viewBoxHeight: viewBoxHeight }
}

function getRoadPolygons(roadGraph: SimpleGraph, streetWidth: number) {
  if (streetWidth < 1) return []
  const roadPolygons: PolygonXY[] = []

  Object.values(roadGraph.edges).forEach((edge) => {
    const v0 = roadGraph.vertices[edge.start]
    const v1 = roadGraph.vertices[edge.end]
    const normal = getUnitNormalVectorXY(v0, v1)
    const p0 = moveAlongVectorXY(v0, normal, streetWidth / 2)
    const p1 = moveAlongVectorXY(v0, normal, -streetWidth / 2)
    const p2 = moveAlongVectorXY(v1, normal, -streetWidth / 2)
    const p3 = moveAlongVectorXY(v1, normal, streetWidth / 2)
    const roadPolygon = [p0, p1, p2, p3]
    roadPolygons.push(roadPolygon)
  })

  return roadPolygons
}

const LoadingSiteThumbnail = memo(_LoadingSiteThumbnail)

function _LoadingSiteThumbnail({ studyPolygon }: { studyPolygon: Shape }) {
  const rotateDirection: Coord2D = [1, 1]
  const viewBoxWidth: number = 100
  const viewBoxHeight: number = 100
  const sitePolygon = ensurePolygonIsXY(alignPolygonXYWithDirection(studyPolygon.vertices, rotateDirection))

  const { centerPoint, scale } = calculateCenterPointAndScaleFromSite(sitePolygon, 100, 100, 0)

  return (
    <svg
      className={styles.thumbnail}
      viewBox={`-${viewBoxWidth / 2} -${viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <defs>
        <linearGradient id="gradient1">
          <stop offset={"0%"} stopColor="#F5F5F5" stopOpacity="0.6">
            <animate
              attributeName="offset"
              dur="1.5s"
              values="-0.75; 0; 0.5; 1"
              keyTimes="0; 0.33; 0.66; 1"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset={"50%"} stopColor="white" stopOpacity="0.1">
            <animate
              attributeName="offset"
              dur="1.5s"
              values="0; 0.5; 1; 1.5"
              keyTimes="0; 0.33; 0.66; 1"
              repeatCount="indefinite"
            />
          </stop>
          <stop stopColor="#F5F5F5" stopOpacity="0.6">
            <animate
              attributeName="offset"
              dur="1.5s"
              values="0.5; 1; 1.5; 1.75"
              keyTimes="0; 0.33; 0.66; 1"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>
      <PolygonWithHoles spacePolygon={sitePolygon} centerPosition={centerPoint} scale={scale} fill="url(#gradient1)" />
    </svg>
  )
}

const SiteStudyThumbnail = memo(_SiteStudyThumbnail)

function _SiteStudyThumbnail({
  siteStudy,
  selected,
  roads,
  trees,
  streetWidth,
}: {
  siteStudy: SiteStudy
  selected: boolean
  roads: boolean
  trees: boolean
  streetWidth: number
}) {
  //TODO: All studies come out rotated 45 degrees (the angle from 0,0 to 1,1). If this changes, this rotation doesn't work
  const rotateDirection: Coord2D = [1, 1]
  const viewBoxWidth: number = 100
  const viewBoxHeight: number = 100

  const sitePolygon = ensurePolygonIsXY(
    alignPolygonXYWithDirection(siteStudy.studyPolygon.shape.vertices, rotateDirection),
  )
  const { centerPoint, scale } = calculateCenterPointAndScaleFromSite(sitePolygon, viewBoxWidth, viewBoxHeight, 0)

  const buildingFootprints = siteStudy.simpleBuildings.flatMap((stack) => {
    return stack.floors[0].outerShapes
  })

  //For small SVGs, the road width gets too large, so we scale it down
  const visualStreetWidth = streetWidth / 2

  const roadPolygons = roads ? getRoadPolygons(siteStudy.roadGraph, visualStreetWidth) : []

  return (
    <svg
      className={styles.thumbnail}
      viewBox={`-${viewBoxWidth / 2} -${viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <PolygonWithHoles
        spacePolygon={sitePolygon}
        centerPosition={centerPoint}
        scale={scale}
        fill={selected ? "#CDEAF7" : "#D9D9D9"}
        fillOpacity={selected ? 0.6 : undefined}
        stroke={selected ? "#0696D7" : "#808080"}
        strokeWidth={selected ? 1 : 0.5}
        className={styles.sitePolygon}
        //strokeOpacity={selected ? undefined : 0.5}
      />
      {trees
        ? siteStudy.parkAreas.map((parkArea, i) => {
            const polygon = ensurePolygonIsXY(alignPolygonWithDirection(parkArea.outerLimit, rotateDirection))
            const holes = parkArea.buildingFootPrints.map((footprint) =>
              ensurePolygonIsXY(alignPolygonWithDirection(footprint, rotateDirection)),
            )
            return (
              <PolygonWithHoles
                key={`thumbnail-park-${i}`}
                spacePolygon={polygon}
                // @ts-expect-error - Incomplete types in JS files.
                spaceHoles={holes}
                centerPosition={centerPoint}
                scale={scale}
                fillOpacity={0.1}
                fill={"green"}
              />
            )
          })
        : null}
      {roadPolygons.map((polygon, i) => (
        <PolygonWithHoles
          key={`thumbnail-road-${i}`}
          spacePolygon={alignPolygonXYWithDirection(polygon, rotateDirection)}
          centerPosition={centerPoint}
          scale={scale}
          fill={"#aaa"}
          stroke={"none"}
        />
      ))}
      {buildingFootprints.map((polygon, i) => (
        <PolygonWithHoles
          key={`thumbnail-building-${i}`}
          spacePolygon={ensurePolygonIsXY(alignPolygonWithDirection(polygon.polygon, rotateDirection))}
          // @ts-expect-error - Incomplete types in JS files.
          spaceHoles={polygon.holes
            .map((hole) => alignPolygonWithDirection(hole, rotateDirection))
            .map(ensurePolygonIsXY)}
          centerPosition={centerPoint}
          scale={scale}
          fill={"white"}
          stroke={"gray"}
          strokeWidth={0.5}
          className={styles.thumbnailBuildingFootprint}
        />
      ))}
      {selected && (
        <PolyLine
          points={sitePolygon}
          centerPosition={centerPoint}
          scale={scale}
          stroke={"#0696D7"}
          strokeWidth={1}
          fill={"none"}
        />
      )}
    </svg>
  )
}
