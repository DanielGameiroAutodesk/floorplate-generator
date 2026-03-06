import sceneManager from "src/core/three/sceneManager"
import type { BufferGeometry } from "three"
import { type Box3, Line3, OrthographicCamera, type PerspectiveCamera, Vector3 } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { elementState } from "src/core/elements/ElementState"
import { MeshBVH } from "three-mesh-bvh"
import cloneDeep from "lodash/cloneDeep"
import { selectedSectionBoxSignal } from "src/integrations/section-box/state"
import { intersectWithBbox } from "src/integrations/section-box/rendering/utilities/extractCutGeometries"
import {
  createSectionCutLineForMeshes,
  elementsBVHSignal,
  type ElementWithBVH,
} from "src/integrations/section-box/rendering/MeshCutRendering"
import {
  createSectionCutLineForTerrain,
  terrainBVHSignal,
} from "src/integrations/section-box/rendering/TerrainCutRendering"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import type { SectionBox } from "src/integrations/section-box/tooling/sectionBox"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import { projectSignal } from "src/core/project/project"
import { idleDebounce } from "src/lib/debounce"
import OcclusionWorker from "./lib/occlusionWorker?worker"
import {
  deserializeLine3,
  serializeBufferGeometry,
  serializeCamera,
  serializeLine3,
  serializeMeshBVH,
  type LineComponents,
} from "./lib/workerUtils"
import { renderRasterLayers } from "./lib/raster-rendering"
import { trimEdgeWithSectionBox, trimGeometryWithSectionBox } from "./lib/section-box-adjustment"
import { getMeshToMeshIntersectionLines } from "./lib/intersection"
import type { WorkerMessage } from "./lib/occlusionWorker"
import { vectorExportEventProperties } from "./lib/tracking"
import { convertRelevantLinesToSvg, getFileName, saveSvg, writeSvg } from "./lib/svgIo"
import type { LinesByBase, LinesByCategory, LineTypes, OccludedLines, RelevantLinesByBase } from "./types"
import {
  cancelVectorExportSignal,
  progressTotalSignal,
  resetVectorExportState,
  startUpDefault,
  vectorExportModalSignal,
  vectorExportProgressSignal,
} from "./state"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const positionsArrayToLines3 = (positions: Float32Array) => {
  const lines: Line3[] = []
  for (let i = 0; i < positions.length; i += 6) {
    lines.push(
      new Line3(
        new Vector3(positions[i], positions[i + 1], positions[i + 2]),
        new Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
      ),
    )
  }
  return lines
}

const getSectionCutLinesForTerrain = idleDebounce(
  (sectionBox: ExtrudedPolygonFeature, terrainBbox: Box3 | null, terrainBVH: MeshBVH) => {
    // Create line where section box cuts terrain
    const modifiedSectionBoxAsFeature = terrainBbox && intersectWithBbox(sectionBox, terrainBbox)
    const terrainCutResult = modifiedSectionBoxAsFeature
      ? createSectionCutLineForTerrain(modifiedSectionBoxAsFeature, terrainBVH)
      : createSectionCutLineForTerrain(sectionBox, terrainBVH)

    const allTerrainCutPoints = terrainCutResult?.positionsArray
    if (allTerrainCutPoints) {
      return positionsArrayToLines3(allTerrainCutPoints)
    }
    return []
  },
)

function getSectionCutLinesForElement(
  elementWithBvh: ElementWithBVH | undefined,
  sectionBox: ExtrudedPolygonFeature | undefined,
) {
  if (elementWithBvh) {
    const sectionCutResult = createSectionCutLineForMeshes(sectionBox, [elementWithBvh])
    if (sectionCutResult) {
      return positionsArrayToLines3(sectionCutResult.positionsArray)
    }
  }
  return []
}

const getElementGeometriesAndLines = async (
  elementSnapshot: ElementSnapshot,
  elementsWithBVH: Map<string, ElementWithBVH>,
  sectionBox: ExtrudedPolygonFeature | undefined,
  terrainEdges: Line3[],
  toplevelNodes: ChildNodeContainer[],
  terrainBVH: MeshBVH,
) => {
  const linesByBase = { base: {}, proposal: {} } as LinesByBase
  linesByBase.proposal["terrain"] = { objectLines: [], sectionCutLines: terrainEdges, terrainIntersectionLines: [] }
  const bufferGeometries: BufferGeometry[] = []

  const nodes: { node: ChildNodeContainer; layer: string; inBase: boolean }[] = []
  const nodesQueue = []
  for (const node of toplevelNodes) {
    const layer = node.elementContainer.mappedCategory
    const inBase = node.isInBase
    const hidden = node.getIsHiddenPeek()
    if (!hidden) nodesQueue.push({ node, layer, inBase })
  }

  while (nodesQueue.length > 0) {
    const currentNode = nodesQueue.pop()
    if (!currentNode) break
    nodes.push(currentNode)
    const childNodes = elementSnapshot.getChildrenOfNode(currentNode.node)
    for (const child of childNodes) {
      nodesQueue.push({ node: child, layer: currentNode.layer, inBase: currentNode.inBase })
    }
  }

  const getGeometryForNode = idleDebounce((node: ChildNodeContainer, layer: string, inBase: boolean) => {
    const outlines = node.svgOutlines.getOrCompute()
    const lines = outlines ? positionsArrayToLines3(outlines) : []

    const elementWithBvh = elementsWithBVH.get(node.path)
    const sectionCutLines = getSectionCutLinesForElement(elementWithBvh, sectionBox)

    let terrainIntersectionLines: Line3[] = []
    const bufferGeo = cloneDeep(node.elementContainer.representations.volumeMesh)
    if (bufferGeo && !node.element.properties?.virtual) {
      bufferGeo.applyMatrix4(node.globalMatrix)
      const sectionBoxAdjustedGeo = sectionBox ? trimGeometryWithSectionBox(bufferGeo, sectionBox) : bufferGeo
      terrainIntersectionLines = terrainIntersectionLines.concat(
        getMeshToMeshIntersectionLines(sectionBoxAdjustedGeo, terrainBVH),
      )
      bufferGeometries.push(sectionBoxAdjustedGeo)
    }

    const baseOrProposal = inBase ? "base" : "proposal"
    const linesByCategory = linesByBase[baseOrProposal]

    if (layer in linesByCategory) {
      linesByCategory[layer].objectLines = linesByCategory[layer].objectLines.concat(lines)
      linesByCategory[layer].sectionCutLines = linesByCategory[layer].sectionCutLines.concat(sectionCutLines)
      linesByCategory[layer].terrainIntersectionLines =
        linesByCategory[layer].terrainIntersectionLines.concat(terrainIntersectionLines)
    } else {
      linesByCategory[layer] = { objectLines: lines, sectionCutLines, terrainIntersectionLines }
    }
  })

  for (const currentNode of nodes) {
    const { node, layer, inBase } = currentNode
    await getGeometryForNode(node, layer, inBase)
  }

  return { linesByCategory: linesByBase, bufferGeometries }
}

const processObjectTerrrainOcclusion = (
  camera: OrthographicCamera | PerspectiveCamera,
  objectsBVH: MeshBVH,
  terrainBVH: MeshBVH,
) => {
  const occlusionWorker = new OcclusionWorker()

  occlusionWorker.postMessage({
    type: "initialize",
    data: {
      camera: serializeCamera(camera),
      objectsBVH: serializeMeshBVH(objectsBVH),
      objectsBVHGeometry: serializeBufferGeometry(objectsBVH.geometry),
      terrainBVH: terrainBVH ? serializeMeshBVH(terrainBVH) : null,
      terrainBVHGeometry: terrainBVH ? serializeBufferGeometry(terrainBVH.geometry) : null,
    },
  })

  const processor = (allLines: Line3[]) => {
    return new Promise<OccludedLines>((resolve, reject) => {
      occlusionWorker.onmessage = function (
        event: MessageEvent<{
          visible: LineComponents[]
          hidden: LineComponents[]
          visibleBelow: LineComponents[]
        }>,
      ) {
        resolve({
          visible: event.data.visible.map(deserializeLine3),
          hidden: event.data.hidden.map(deserializeLine3),
          visibleBelow: event.data.visibleBelow.map(deserializeLine3),
        })
      }
      occlusionWorker.onerror = function (error: ErrorEvent) {
        reject(new Error(error.message))
        occlusionWorker.terminate()
      }

      occlusionWorker.postMessage({
        type: "process",
        data: {
          allLines: allLines.map(serializeLine3),
        },
      } as WorkerMessage)
    })
  }

  return { processor, terminateWorker: () => occlusionWorker.terminate() }
}

const findRelevantLines = async (
  processor: (allLines: Line3[]) => Promise<OccludedLines>,
  linesByCategory: LineTypes,
  sectionBox: SectionBox | undefined,
) => {
  const objectLines = linesByCategory.objectLines
    .map((edge) => (sectionBox ? trimEdgeWithSectionBox(edge, sectionBox) : edge))
    .filter((_) => _ instanceof Line3)

  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    throw new Error("Export cancelled")
  }
  vectorExportProgressSignal.value = {
    progress: (vectorExportProgressSignal.peek()?.progress ?? 0) + 1,
    message: `Identifying lines...`,
  }
  const { visible, hidden, visibleBelow } = await processor(objectLines)

  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    throw new Error("Export cancelled")
  }

  vectorExportProgressSignal.value = {
    progress: (vectorExportProgressSignal.peek()?.progress ?? 0) + 1,
    message: `Identifying lines...`,
  }
  const {
    visible: sectionCutVisible,
    hidden: sectionCutOccluded,
    visibleBelow: sectionCutVisibleBelow,
  } = await processor(linesByCategory.sectionCutLines)
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    throw new Error("Export cancelled")
  }
  vectorExportProgressSignal.value = {
    progress: (vectorExportProgressSignal.peek()?.progress ?? 0) + 1,
    message: `Identifying lines...`,
  }
  const {
    visible: terrainIntersectionVisible,
    hidden: terrainIntersectionOccluded,
    visibleBelow: terrainIntersectionBelow,
  } = await processor(linesByCategory.terrainIntersectionLines)

  return {
    visible: {
      objectLines: visible,
      sectionCutLines: sectionCutVisible,
      terrainIntersectionLines: terrainIntersectionVisible,
    },
    hidden: {
      objectLines: hidden,
      sectionCutLines: sectionCutOccluded,
      terrainIntersectionLines: terrainIntersectionOccluded,
    },
    visibleBelowTerrain: {
      objectLines: visibleBelow,
      sectionCutLines: sectionCutVisibleBelow,
      terrainIntersectionLines: terrainIntersectionBelow,
    },
  }
}

export default async function vectorSceneExport() {
  Analytics.track(EventName.Export, vectorExportEventProperties)

  vectorExportProgressSignal.value = startUpDefault
  vectorExportModalSignal.value = true

  const projectName = projectSignal.peek()?.name
  const proposalName = elementState.currentProposalSignal.peek().element.properties.name
  const fileName = getFileName(projectName, proposalName)

  const terrainBVH = terrainBVHSignal.peek()
  const terrainMesh = terrainSignal.peek().mesh
  const terrainBbox = terrainMesh.geometry.boundingBox

  const elementsWithBVH = elementsBVHSignal.peek()
  const sectionBox = selectedSectionBoxSignal.peek()?.box
  const toplevelNodes = elementState.currentProposalSignal.peek().getToplevelNodes()
  const elementSnapshot = elementState.currentSnapshot.peek()

  let terrainInSectionBoxBVH = terrainBVH
  if (sectionBox) {
    const terrainGeo = cloneDeep(terrainMesh.geometry)
    const terrainInsideSectionBox = trimGeometryWithSectionBox(terrainGeo, sectionBox)
    terrainInSectionBoxBVH = new MeshBVH(terrainInsideSectionBox)
  }
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    return // Check for cancel signal
  }
  const rasterLayers = renderRasterLayers(terrainMesh)
  const terrainEdges = sectionBox ? await getSectionCutLinesForTerrain(sectionBox, terrainBbox, terrainBVH) : []
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    return // Check for cancel signal
  }
  const { linesByCategory, bufferGeometries } = await getElementGeometriesAndLines(
    elementSnapshot,
    elementsWithBVH,
    sectionBox,
    terrainEdges,
    toplevelNodes,
    terrainBVH,
  )
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    return // Check for cancel signal
  }
  if (bufferGeometries.length === 0) {
    saveSvg(writeSvg([], rasterLayers), fileName)
    vectorExportProgressSignal.value = null
    return
  }

  const mergedGeo = mergeGeometries(bufferGeometries, false)
  const bvh = new MeshBVH(mergedGeo)
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    return // Check for cancel signal
  }
  const isCameraOrthographic = sceneManager.camera instanceof OrthographicCamera
  const camera = isCameraOrthographic
    ? (sceneManager.camera as OrthographicCamera)
    : (sceneManager.camera as PerspectiveCamera)

  progressTotalSignal.value =
    Object.keys(linesByCategory.base).length * 3 + Object.keys(linesByCategory.proposal).length * 3 + 2

  const { processor: processObjectTerrainOcclusion, terminateWorker } = processObjectTerrrainOcclusion(
    camera,
    bvh,
    terrainInSectionBoxBVH,
  )

  const baseLines: Record<string, LinesByCategory> = {}
  for (const [layerName, lineTypes] of Object.entries(linesByCategory.base)) {
    if (cancelVectorExportSignal.peek()) {
      resetVectorExportState()
      return // Check for cancel signal
    }
    try {
      baseLines[layerName] = await findRelevantLines(processObjectTerrainOcclusion, lineTypes, sectionBox)
    } catch (e) {
      if (e instanceof Error && e.message === "Export cancelled") {
        resetVectorExportState()
        return // Check for cancel signal
      }
    }
  }
  const proposalLines: Record<string, LinesByCategory> = {}
  for (const [layerName, lineTypes] of Object.entries(linesByCategory.proposal)) {
    if (cancelVectorExportSignal.peek()) {
      resetVectorExportState()
      return // Check for cancel signal
    }
    try {
      proposalLines[layerName] = await findRelevantLines(processObjectTerrainOcclusion, lineTypes, sectionBox)
    } catch (e) {
      if (e instanceof Error && e.message === "Export cancelled") {
        resetVectorExportState()
        return // Check for cancel signal
      }
    }
  }

  terminateWorker()

  const relevantLinesByCategory = { base: baseLines, proposal: proposalLines } as RelevantLinesByBase

  vectorExportProgressSignal.value = {
    progress: (vectorExportProgressSignal.peek()?.progress ?? 0) + 1,
    message: "Finalizing...",
  }
  if (cancelVectorExportSignal.peek()) {
    resetVectorExportState()
    return // Check for cancel signal
  }
  const svgContent = convertRelevantLinesToSvg(relevantLinesByCategory)
  saveSvg(writeSvg(svgContent, rasterLayers), fileName)
  resetVectorExportState(true)
}
