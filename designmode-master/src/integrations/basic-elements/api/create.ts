import type { BasicAction, BasicCreateAction, BasicUpdateAction } from "./types"
import type { BasicActionDependencies } from "./actionDependencies"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { createUrn, newId, newRevision } from "src/lib/element/urn"
import { findBatch, getBasicBatchUpdates, parseUrnBatch } from "./batching"
import type { Child, FormaElement } from "@spacemakerai/element-types"
import { Matrix4 } from "three"
import { generateChildren } from "./generator"
import { getParentPath, mergePath } from "src/lib/element/path"
import { geometryFromGeojson } from "src/lib/three/geometryFromGeojson"
import type { BasicFeature, BasicLine } from "src/lib/geometry/geometryTypes"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import { featureToTerrainShape } from "./terrainShape"
import { getInMapOrThrow } from "src/lib/map"
import { PROJECT_ID } from "src/core/project/project"
import { generatePolygonsFromLineString } from "./copy-from-basic-element-api/lineStringToPolygon"
import type { Feature, LineString } from "geojson"

export function createActionsFromBasicActions(
  actions: BasicAction[],
  dependencies: BasicActionDependencies,
  skipBatching_temp: boolean = false,
): Action[] {
  const revision = newRevision()
  const elementActions: Action[] = actions.flatMap((a) => basicActionToCoreActions(a, dependencies, revision))
  if (skipBatching_temp) {
    return elementActions
  }
  const batchActions = getBasicBatchUpdates(elementActions, dependencies.proposal.snapshot)
  return [...elementActions, ...batchActions]
}

function basicActionToCoreActions(
  action: BasicAction,
  dependencies: BasicActionDependencies,
  revision: string,
): Action[] {
  switch (action.type) {
    case "basic-create":
      return createElementAndGenerateChildren(action, dependencies, revision)
    case "basic-update":
      return updateElementAndGenerateChildren(action, dependencies, revision)
  }
}

function generateTerrainShapeByBasicFeature(newElement: FormaElement, feature: BasicFeature) {
  if (newElement.properties?.category === "road") {
    const properties = (feature as BasicLine)?.properties || {}
    const lineWidth = properties.lineWidth || 6
    return generatePolygonsFromLineString(feature as Feature<LineString>, lineWidth)
  } else {
    return feature && featureToTerrainShape(feature, newElement)
  }
}

// This function could be cleaned up. We probably don't need distinct types for the three different update actions.
function updateElementAndGenerateChildren(
  action: BasicUpdateAction,
  { proposal, batchSizes, terrainSampler }: BasicActionDependencies,
  revision: string,
): Action[] {
  const node = proposal.snapshot.getNodeOrThrow(action.path)
  const prevUrn = node?.elementContainer.element.urn

  const batchId =
    action.options?.overrideBatchId ??
    findBatch(getParentPath(action.path)!, proposal.snapshot.getFormaElementLookup(), proposal.urn, batchSizes, prevUrn)

  const { internalId } = parseUrnBatch(prevUrn)
  const urn = createUrn("basic", PROJECT_ID, `${batchId}+${internalId}`, revision)

  const prevElement = getInMapOrThrow(proposal.snapshot.elements, prevUrn).element

  const newProperties: BasicElementProperties = {
    ...(prevElement.properties as BasicElementProperties),
    ...(action.properties ?? {}),
  }

  const parentTransform = node.parentMatrix
  const oldWorldTransform = node.globalMatrix
  const newWorldTransform = action.child?.transform
    ? parentTransform.clone().multiply(new Matrix4().fromArray(action.child?.transform))
    : oldWorldTransform

  const generated = generateChildren(
    batchId,
    revision,
    newProperties,
    action.path,
    newWorldTransform ?? new Matrix4(),
    action.feature ?? (node.elementContainer.getRepresentationOrThrow("footprint") as BasicFeature),
    terrainSampler,
    proposal,
  )

  const newElement: FormaElement = {
    ...prevElement,
    urn,
    properties: newProperties, // Might be unchanged, but that is ok
    children: generated?.map((action): Child => ({ ...action.child, urn: action.element.urn })),
  }

  let a: Action<"update">
  if (action.feature) {
    const geo = geometryFromGeojson(action.feature)
    const terrainShape = generateTerrainShapeByBasicFeature(newElement, action.feature)
    a = {
      type: "update",
      path: action.path,
      element: newElement,
      representations: {
        footprint: action.feature,
        volumeMesh: geo,
        terrainShape: terrainShape,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      child: action.child,
      persisted: false,
    }
  } else {
    // Even though there are no new feature on the actions, properties on the element could be changed causing changes
    // on the visual terrain shape
    const oldGeojson = node.elementContainer.representations.footprint as BasicFeature
    const newTerrainShape = oldGeojson ? generateTerrainShapeByBasicFeature(newElement, oldGeojson) : undefined

    a = {
      type: "update",
      path: action.path,
      element: newElement,
      cloneGeometry: true,
      representations: {
        volumeMesh: undefined,
        footprint: undefined,
        terrainShape: newTerrainShape,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      child: action.child,
      persisted: false,
    }
  }

  return [a, ...(generated ?? [])]
}

function createElementAndGenerateChildren(
  { parentPath, child, feature, properties, options }: BasicCreateAction,
  { batchSizes, proposal, terrainSampler }: BasicActionDependencies,
  revision: string,
): Action[] {
  const internalId = newId()
  const batchId =
    options?.overrideBatchId ??
    findBatch(parentPath, proposal.snapshot.getFormaElementLookup(), proposal.urn, batchSizes)
  const urn = createUrn("basic", PROJECT_ID, `${batchId}+${internalId}`, revision)

  const parentNode = proposal.snapshot.getNodeOrThrow(parentPath)

  const globalTransform = parentNode.globalMatrix.clone()
  if (child.transform) globalTransform.multiply(new Matrix4().fromArray(child.transform))

  const generated =
    feature &&
    generateChildren(
      batchId,
      revision,
      properties,
      mergePath(parentPath, child.key),
      globalTransform,
      feature,
      terrainSampler,
      proposal,
    )

  const baseElement = {
    urn,
    properties,
    children: generated?.map((action): Child => ({ ...action.child, urn: action.element.urn })),
  }

  const geo = feature && geometryFromGeojson(feature)
  const terrainShape =
    feature && !(feature.properties && "height" in feature.properties)
      ? featureToTerrainShape(feature, baseElement)
      : undefined

  const action: Action<"create"> = {
    type: "create",
    parentPath,
    child,
    element: baseElement,
    representations: feature
      ? {
          footprint: feature,
          volumeMesh: geo,
          terrainShape: terrainShape,
          terrainTexture: undefined,
          buildingFloors3DSketch_UNSTABLE: undefined,
        }
      : undefined,
    persisted: false,
  }

  const actions = [action, ...(generated ?? [])]
  return actions
}
