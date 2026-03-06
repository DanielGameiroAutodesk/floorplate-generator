import type { InternalPath } from "src/lib/element/path"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import { elementState } from "src/core/elements/ElementState"
import { useMemo, useState } from "preact/hooks"
import { Group, type Matrix4, Mesh, Vector3 } from "three"
import { useCallback, useEffect } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import transportationApi, {
  type RadiusPointsUnprocessed,
  type TransportationElement,
} from "src/integrations/transportation/lib/transportationApi"
import { actionApi as actionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { batch, useComputed, useSignal, useSignalEffect } from "@preact/signals"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { generateCenterLineVisualsTempHack, getLinesAndPointsMesh, getCurveSeparationLines } from "./toolVisuals"
import { createElementContainer } from "src/integrations/transportation/glue"
import { EditProperties } from "src/integrations/transportation/PropertyPanels/EditProperties"
import { activeRadiusIndicatorPointSignal, setRadiusControlData } from "./RadiusControl"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import EditTransportCurveTool, { selectedPointSignal, type Vec3WithId } from "./EditTransportCurveTool"
import { computeCornerAngles } from "src/integrations/transportation/utils"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const makeEditTransportCurveToolConfig = (path: InternalPath): ToolCfg => ({
  id: "transportCurve",
  tool: () => <EditTransportCurve path={path} />,
  propertyPanel: () => <EditProperties />,
  toolbar: () => <ToolbarCloseButton />,
})

function EditTransportCurve({ path }: { path: InternalPath }) {
  const renderApi = useRenderAPI("EditTransportCurve")
  const contextRoot = scenarioModeSignal.value ? "base" : "proposal"
  const snapshot = elementState.currentSnapshot.value
  const terrain = terrainSignal.value

  const node = snapshot.getNode(path)
  const element = node?.element
  if (!transportationApi.isTransportationElement(element)) throw new Error("Element not found")

  const liveElementSignal = useSignal(element)
  const liveElement = liveElementSignal.value
  useEffect(() => {
    liveElementSignal.value = element
  }, [element, liveElementSignal])

  const globalMatrix = node!.globalMatrix
  //TODO todo should not work on internal representation. use api?
  const { bufferedCurve, type } = useMemo(() => transportationApi.extractDefiningRep(liveElement), [liveElement])

  const vec3LineStringWithIds: Vec3WithId[] = useMemo(() => {
    const lineStringAsVec3 = bufferedCurve.points.map((point) => {
      const xyPositioned = new Vector3(point.position.x, point.position.y, 0).applyMatrix4(globalMatrix)
      const elevation = terrain.elevationAt(xyPositioned.x, xyPositioned.y)
      return new Vector3(xyPositioned.x, xyPositioned.y, elevation)
    })
    return lineStringAsVec3.map((v, i) => ({ position: v, id: bufferedCurve.points[i].id }))
  }, [bufferedCurve, globalMatrix, terrain])

  const [toolMesh, setToolMesh] = useState<Group>(
    new Group().add(getLinesAndPointsMesh(vec3LineStringWithIds, undefined)),
  )
  renderApi.useObjectLifecycle_TEMPORARY_FIX(toolMesh, true, sceneManager.scene)
  const [curveSegmentVisuals, setCurveSegmentVisuals] = useState<Mesh>(new Mesh())
  renderApi.useObjectLifecycle_TEMPORARY_FIX(curveSegmentVisuals, true, sceneManager.scene)

  useEffect(() => {
    setCurveSegmentVisuals(getCurveSeparationLines(element, terrain.terrainSamplerData, globalMatrix))
  }, [element, terrain.terrainSamplerData, globalMatrix])

  // This is a temporary fix to cope with missing functionality in the old ActionApi preview. Hence,  we don't want to mix it with  toolsMesh.
  const [outlinesVisuals, setOutlinesVisuals] = useState<Group>(new Group())
  renderApi.useObjectLifecycle_TEMPORARY_FIX(outlinesVisuals, true, sceneManager.scene)

  // TODO: Can this logic be extracted to a custom hook or something else to clarify its intent?
  const radiusPreviewElementSignal = useSignal<TransportationElement | undefined>(undefined)
  const pointsPreviewElementSignal = useSignal<TransportationElement | undefined>(undefined)
  const previewElementSignal = useComputed(() => {
    const radiusRevision = parseInt(radiusPreviewElementSignal.value?.urn.split(":").pop() ?? "0")
    const pointsRevision = parseInt(pointsPreviewElementSignal.value?.urn.split(":").pop() ?? "0")
    return radiusRevision > pointsRevision ? radiusPreviewElementSignal.value : pointsPreviewElementSignal.value
  })

  const previewElement = previewElementSignal.value

  const onPreviewPoints = useCallback(
    (points: Vec3WithId[]) => {
      setToolMesh(new Group().add(getLinesAndPointsMesh(points, undefined)))
      const basisElement = radiusPreviewElementSignal.peek() || liveElementSignal.peek()

      const updatedElement = getElementWithUpdatedPoints(basisElement, points, globalMatrix)
      pointsPreviewElementSignal.value = updatedElement
    },
    [liveElementSignal, globalMatrix, radiusPreviewElementSignal, pointsPreviewElementSignal],
  )

  const onPreviewUpdateSelectedRadius = useCallback(
    (radius: number, pointId: string) => {
      const basisElement = pointsPreviewElementSignal.peek() || liveElementSignal.peek()
      const updatedElement = transportationApi.updateRadiusOnPoint(basisElement, pointId, radius)
      radiusPreviewElementSignal.value = updatedElement
    },
    [liveElementSignal, radiusPreviewElementSignal, pointsPreviewElementSignal],
  )

  useEffect(() => {
    if (previewElement) {
      const container = createElementContainer(previewElement)
      const terrainShape = container.representations.terrainShape

      const action = actionAPI.update.one(path, previewElement, false, {
        child: node!.child,
        representations: {
          volumeMesh: undefined,
          terrainShape: terrainShape,
          footprint: undefined,
          terrainTexture: undefined,
          buildingFloors3DSketch_UNSTABLE: undefined,
        },
      })
      const outlinesVisuals = generateCenterLineVisualsTempHack(
        previewElement,
        globalMatrix,
        terrain.terrainSamplerData,
      )
      setOutlinesVisuals(outlinesVisuals)

      const lineSegmentsMesh = getCurveSeparationLines(previewElement, terrain.terrainSamplerData, globalMatrix)
      setCurveSegmentVisuals(lineSegmentsMesh)

      actionAPI.preview_UNSTABLE(action)
    } else {
      actionAPI.resetPreview_UNSTABLE()
    }
  }, [previewElement, terrain.terrainSamplerData, path, node, globalMatrix])

  const updateSelectedRadius = useCallback(
    (radius: number, pointId: string) => {
      const previousRadius = transportationApi
        .extractDefiningRep(liveElementSignal.peek())
        .bufferedCurve.points.find((p) => p.id === pointId)?.radius
      if (previousRadius && Math.abs(radius - previousRadius) < 1e-8 * previousRadius) return

      const basisElement = previewElementSignal.peek() || liveElementSignal.peek()
      const updatedElement = transportationApi.updateRadiusOnPoint(basisElement, pointId, radius)

      const container = createElementContainer(updatedElement)
      if (!container) return

      elementState.edit(({ updateElement }) =>
        updateElement(contextRoot, { ...node!.child, urn: container?.element.urn }, container),
      )
      batch(() => {
        liveElementSignal.value = updatedElement
        radiusPreviewElementSignal.value = undefined
        pointsPreviewElementSignal.value = undefined
      })
      actionAPI.resetPreview_UNSTABLE()
    },
    [
      liveElementSignal,
      contextRoot,
      node,
      radiusPreviewElementSignal,
      pointsPreviewElementSignal,
      previewElementSignal,
    ],
  )

  const onComplete = useCallback(
    (points: Vec3WithId[]) => {
      if (JSON.stringify(points) === JSON.stringify(vec3LineStringWithIds)) return

      setToolMesh(getLinesAndPointsMesh(points, undefined))
      setOutlinesVisuals(new Group())
      const basisElement = previewElementSignal.peek() || liveElementSignal.peek()

      const updatedElement = getElementWithUpdatedPoints(basisElement, points, globalMatrix)
      const container = createElementContainer(updatedElement)

      if (!container) return

      elementState.edit(({ updateElement }) =>
        updateElement(contextRoot, { ...node!.child, urn: container?.element.urn }, container),
      )
      batch(() => {
        liveElementSignal.value = updatedElement
        radiusPreviewElementSignal.value = undefined
        pointsPreviewElementSignal.value = undefined
      })
      actionAPI.resetPreview_UNSTABLE()

      const prevLength = vec3LineStringWithIds.length
      const action =
        points.length > prevLength ? "vertex-add" : points.length < prevLength ? "vertex-remove" : "vertex-move"
      Analytics.trackEditElement(
        EventName.Edit,
        { feature_category: FeatureCategory.DesignTool, feature: "transportation", object_type: "element" },
        { category: transportationApi.transportTypeToElementCategory(type), transportation_curve_action: action },
      )
    },
    [
      liveElementSignal,
      globalMatrix,
      vec3LineStringWithIds,
      contextRoot,
      node,
      radiusPreviewElementSignal,
      pointsPreviewElementSignal,
      previewElementSignal,
      type,
    ],
  )

  const resetPreview = useCallback(() => {
    const outlinesVisuals = generateCenterLineVisualsTempHack(
      liveElementSignal.peek(),
      globalMatrix,
      terrain.terrainSamplerData,
    )
    setOutlinesVisuals(outlinesVisuals)
    setToolMesh(getLinesAndPointsMesh(vec3LineStringWithIds, undefined))
    setCurveSegmentVisuals(getCurveSeparationLines(liveElementSignal.peek(), terrain.terrainSamplerData, globalMatrix))
    batch(() => {
      radiusPreviewElementSignal.value = undefined
      pointsPreviewElementSignal.value = undefined
    })
    actionAPI.resetPreview_UNSTABLE()
  }, [
    vec3LineStringWithIds,
    terrain.terrainSamplerData,
    globalMatrix,
    radiusPreviewElementSignal,
    pointsPreviewElementSignal,
    liveElementSignal,
  ])

  const onHover = useCallback(
    (pointId: string | undefined) => {
      setToolMesh(new Group().add(getLinesAndPointsMesh(vec3LineStringWithIds, pointId)))
    },
    [vec3LineStringWithIds],
  )

  const exitCallback = useCallback(() => {
    onComplete(vec3LineStringWithIds)
    exitCurrentTool()
    actionAPI.resetPreview_UNSTABLE()
  }, [vec3LineStringWithIds, onComplete])

  const curvePointsLiveOrPreview = useMemo(() => {
    const element = previewElement || liveElement
    return transportationApi.extractDefiningRep(element).bufferedCurve.points
  }, [previewElement, liveElement])
  const previouslySelectedPointsSetSignal = useSignal(new Set<string>())
  const selectedPointIds = previouslySelectedPointsSetSignal.value
  useEffect(() => {
    const cornerAngles = computeCornerAngles(curvePointsLiveOrPreview.map((v) => v.position))
    const radiusPerStoredId = new Map(bufferedCurve.points.map((p) => [p.id, p.radius]))
    setRadiusControlData({
      pointsWithRadius: curvePointsLiveOrPreview
        .slice(1, -1)
        .filter((_, i) => Math.abs(Math.PI - cornerAngles[i]) > 1e-6)
        .filter(({ id }) => selectedPointIds.has(id) || (radiusPerStoredId.get(id) ?? 0) > 0),
      setRadiusOnPoint: updateSelectedRadius,
      previewRadiusOnPoint: onPreviewUpdateSelectedRadius,
      globalTransform: globalMatrix,
      cancel: exitCallback,
      transportationType: type,
    })
  }, [
    curvePointsLiveOrPreview,
    bufferedCurve,
    globalMatrix,
    updateSelectedRadius,
    exitCallback,
    onPreviewUpdateSelectedRadius,
    selectedPointIds,
    type,
  ])
  useSignalEffect(() => {
    if (selectedPointSignal.value) {
      activeRadiusIndicatorPointSignal.value = selectedPointSignal.value.id
      previouslySelectedPointsSetSignal.value = new Set(previouslySelectedPointsSetSignal.peek()).add(
        selectedPointSignal.value.id,
      )
    }
  })

  useEffect(
    () => () => {
      actionAPI.resetPreview_UNSTABLE()
      setRadiusControlData(undefined)
    },
    [],
  )

  return (
    <>
      <EditTransportCurveTool
        pointsWithIds={vec3LineStringWithIds}
        onHover={onHover}
        onPreview={onPreviewPoints}
        onComplete={onComplete}
        resetPreview={resetPreview}
        exitCallback={exitCallback}
      />
    </>
  )
}

function getElementWithUpdatedPoints(
  element: TransportationElement,
  points3D: Vec3WithId[],
  globalMatrix: Matrix4,
): TransportationElement {
  const vec3s = points3D.map((v) => v.position)
  const preTransformPoints = getPreTransformPoints(vec3s, globalMatrix)
  const curvePoints: RadiusPointsUnprocessed[] = preTransformPoints.map((v, i) => ({
    id: points3D[i].id,
    position: { x: v.x, y: v.y },
  }))

  return transportationApi.updateControlPoints(element, curvePoints)
}

const getPreTransformPoints = (points: Vector3[], transform: Matrix4): Vector3[] => {
  const inverseTransform = transform.clone().invert()
  return points.map((v) => v.clone().applyMatrix4(inverseTransform))
}
