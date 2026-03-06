import type { BlobId, BlobReference, BlobResponse, CompositeClient, ItemFailure } from "@spacemakerai/elements-client"
import {
  ApiClient,
  createDefaultBrowserClient,
  createSelectionPredicate,
  getBlobReference,
  getRepresentationAndCacheKey,
  loadRepresentationBinary,
  loadRepresentationJson,
} from "@spacemakerai/elements-client"
import type { GLTF } from "three/addons/loaders/GLTFLoader.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { FormaElement, RepresentationSelection, Urn } from "@spacemakerai/element-types"
import { mergeGroupWithSplit, yUpToZUp } from "src/lib/download-helpers"
import type { FeatureCollection } from "geojson"
import type { BufferGeometry, Material, MeshStandardMaterial } from "three"
import { BoxGeometry, BufferAttribute, Color, LineSegments, Matrix4, Mesh } from "three"
import { parseUrn } from "src/lib/element/urn"
import { captureLogAndToast } from "src/core/sentry"
import { setGeometryColor } from "src/lib/three/geometryUtils"
import { isFlagActive, LDFlag, URLFlag, urlFlags } from "src/lib/featureToggling"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { addToMap } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { freezeFormaElement } from "src/lib/element/freeze"
import type { JsonRepresentations } from "forma-elements"
// eslint-disable-next-line import/no-restricted-paths
import type { Building3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"

// TODO (refactor): Assign directly instead of lazy.
let elementsClient: CompositeClient | undefined

export function getElementsClient() {
  const basicBatchActive = isFlagActive(LDFlag.BasicBatch)
  if (elementsClient == null) {
    const delegate = ApiClient.createDefaultUrlBuilder()
    const urlBuilder: ApiClient.UrlBuilder = {
      ...delegate,
      getElementUrl: (options) => {
        const originalUrl = delegate.getElementUrl(options)
        switch (options.system) {
          case "integrate": {
            const url = new URL(originalUrl, document.location.origin)
            url.searchParams.set("cachev", "1")
            url.searchParams.set("shallow", "true")
            return url.toString()
          }
          case "basic": {
            const url = new URL(originalUrl, document.location.origin)
            url.searchParams.set("roadsAsPolygons", "true")
            return url.toString()
          }
          default:
            return originalUrl
        }
      },
      getElementsBatchUrl: (options) => {
        const originalUrl = delegate.getElementsBatchUrl(options)
        switch (options.system) {
          case "integrate": {
            const url = new URL(originalUrl, document.location.origin)
            url.searchParams.set("cachev", "1")
            url.searchParams.set("shallow", "true")
            return url.toString()
          }
          case "basic": {
            const url = new URL(originalUrl, document.location.origin)
            url.searchParams.set("roadsAsPolygons", "true")
            return url.toString()
          }
          default:
            return originalUrl
        }
      },
      getBlobsBatchUrl: (options) => {
        const originalUrl = delegate.getBlobsBatchUrl(options)
        switch (options.system) {
          case "integrate": {
            return originalUrl
          }
          case "basic": {
            const url = new URL(originalUrl, document.location.origin)
            url.searchParams.set("roadsAsPolygons", "true")
            return url.toString()
          }
          default:
            return originalUrl
        }
      },
    }

    const additionalBatchSystems = basicBatchActive ? ["basic"] : []

    elementsClient = createDefaultBrowserClient({
      clientName: "designmode",
      apiClientOptions: {
        urlBuilder,
      },
      elementsOptions: {
        transformElement: (element) => {
          const { system: systemName } = parseUrn(element.urn)
          const system = getRegisteredElementSystem(systemName)

          if (system && system.elementsClientLoadTransform) {
            return system.elementsClientLoadTransform(element)
          }

          return freezeFormaElement(element)
        },
        async bypass({ system: systemName, urns }) {
          const system = getRegisteredElementSystem(systemName)
          if (!system || !system.elementsClientElementsBypass) {
            return
          }

          const elements = new Map<Urn, FormaElement>()
          const errors = new Map<Urn, ItemFailure>()

          try {
            const result = await Promise.all(system.elementsClientElementsBypass(Array.from(urns)))
            for (const items of result) {
              addToMap(elements, items)
            }
          } catch (e) {
            for (const urn of urns) {
              // Might consider mapping this to more exact errors.
              errors.set(urn, { code: "other", cause: e instanceof Error ? e : undefined })
            }
          }

          return {
            elements,
            errors,
          }
        },
        additionalBatchSystems,

        // Limit requests to 200 items per batch, even though the element system spec allows up to
        // 1000 (which is the default in elements-client). Too large batches are prone to timeouts
        // in the backend lambdas. Limiting batches here in the frontend allows us to send multiple,
        // smaller batch requests at the same time, reducing latency as well as improving resiliency
        batchMaxItems: 200,
      },
      blobsOptions: {
        async bypass({ authcontext, system: systemName, blobIds }) {
          const getBlobReferenceOfBlobId = (blobId: BlobId) =>
            getBlobReference({ system: systemName, authcontext, blobId })

          const system = getRegisteredElementSystem(systemName)
          if (!system || !system.elementsClientBlobsBypass) {
            return
          }

          const blobs = new Map<BlobReference, BlobResponse>()
          const errors = new Map<BlobReference, ItemFailure>()
          let bufferId = 0

          try {
            const result = await system.elementsClientBlobsBypass(Array.from(blobIds))
            for (const [blobId, blobData] of result) {
              blobs.set(getBlobReferenceOfBlobId(blobId), {
                bufferId: bufferId++,
                data: blobData,
              })
            }
          } catch (e) {
            for (const blobId of blobIds) {
              // Might consider mapping this to more exact errors.
              errors.set(getBlobReferenceOfBlobId(blobId), { code: "other", cause: e instanceof Error ? e : undefined })
            }
            return
          }

          return {
            blobs,
            errors,
          }
        },
        additionalBatchSystems,

        // Limit requests to 200 items per batch, even though the element system spec allows up to
        // 1000 (which is the default in elements-client). Too large batches are prone to timeouts
        // in the backend lambdas. Limiting batches here in the frontend allows us to send multiple,
        // smaller batch requests at the same time, reducing latency as well as improving resiliency
        batchMaxItems: 200,
      },
      elementsCache: urlFlags[URLFlag.BatchNoCache] ? null : undefined,
      blobsCache: urlFlags[URLFlag.BatchNoCache] ? null : undefined,
    }).client
  }
  return elementsClient
}

// Eagerly load clients to reduce IndexedDB loading time.
getElementsClient()

export type TerrainTexture = {
  cacheKey: string
  image: ArrayBuffer
  properties: {
    boundingBox: number[][][]
    color: string
    opacity: number
    mimeType: string
  }
}

const gltfCache = new Map<string, Promise<GLTF>>()
const footprintCache = new Map<string, Promise<FeatureCollection>>()
const terrainShapeCache = new Map<string, Promise<JsonRepresentations["terrainShape"]>>()
const terrainTextureCache = new Map<string, Promise<TerrainTexture>>()
const buildingFloors3DSketchCache = new Map<string, Promise<Building3d>>()

export async function getRepresentationsByUrn(elements: FormaElementLookup): Promise<RepresentationsByUrn> {
  const start = performance.now()

  const promises: Promise<void>[] = []
  const representations: RepresentationsByUrn = {
    volumeMesh: new Map(),
    footprint: new Map(),
    terrainShape: new Map(),
    terrainTexture: new Map(),
    buildingFloors3DSketch_UNSTABLE: new Map(),
  }

  for (const element of elements) {
    const { system, id: elementId, revision } = parseUrn(element.urn)

    const elementsystem = getRegisteredElementSystem(system)
    if (elementsystem?.customFetchVolumeMesh) {
      const volumeMesh = await elementsystem.customFetchVolumeMesh(element)
      if (volumeMesh) {
        volumeMesh.name = `${system} - ${elementId} - ${revision}`
        representations.volumeMesh.set(element.urn, volumeMesh)
        continue
      }
    } else if (elementsystem?.customFetchVolumeMeshes) {
      const updates = await elementsystem.customFetchVolumeMeshes(element)
      for (const [urn, volumeMesh] of updates) {
        representations.volumeMesh.set(urn, volumeMesh)
      }
      continue
    }

    const volumeMeshRep = getRepresentationAndCacheKey(element, "volumeMesh")
    if (volumeMeshRep) {
      let gltfPromise = gltfCache.get(volumeMeshRep.cacheKey)

      if (!gltfPromise) {
        gltfPromise = (async () => {
          const data = await loadRepresentationBinary(element.urn, volumeMeshRep.representation, getElementsClient())

          const gltf: GLTF = await new Promise((resolve, reject) => new GLTFLoader().parse(data, "", resolve, reject))
          gltf.scene.updateMatrixWorld()

          return gltf
        })()

        gltfCache.set(volumeMeshRep.cacheKey, gltfPromise)
      }

      promises.push(
        gltfPromise
          .then((gltf) => {
            return createCombinedAndSplitGeometriesForGltf(gltf, volumeMeshRep.representation.selection, element)
          })
          .catch((error) => ({
            combinedGeometry: handleVolumeMeshError(error, element),
            splitResult: {} as { opaque?: BufferGeometry; transparent?: BufferGeometry },
          }))
          .then(({ combinedGeometry, splitResult }) => {
            if (combinedGeometry) {
              combinedGeometry.name = `${system} - ${elementId.split("-").slice(-1).join("-")} - ${revision}`
              representations.volumeMesh.set(element.urn, combinedGeometry)
            }

            if (splitResult.opaque && splitResult.transparent) {
              splitResult.opaque.name = `${system} - ${elementId.split("-").slice(-1).join("-")} - ${revision} - opaque`
              splitResult.transparent.name = `${system} - ${elementId.split("-").slice(-1).join("-")} - ${revision} - transparent`

              if (!representations.volumeMeshWithTransparencySupport) {
                representations.volumeMeshWithTransparencySupport = new Map()
              }
              representations.volumeMeshWithTransparencySupport.set(element.urn, {
                opaqueGeometry: splitResult.opaque,
                transparentGeometry: splitResult.transparent,
              })
            }
          }),
      )
    }

    const outlinesRep = getRepresentationAndCacheKey(element, "outlines" as any)
    if (outlinesRep) {
      let gltfPromise = gltfCache.get(outlinesRep.cacheKey)

      if (!gltfPromise) {
        gltfPromise = (async () => {
          const data = await loadRepresentationBinary(element.urn, outlinesRep.representation, getElementsClient())
          const gltf: GLTF = await new Promise((resolve, reject) => new GLTFLoader().parse(data, "", resolve, reject))
          gltf.scene.updateMatrixWorld()
          return gltf
        })()

        gltfCache.set(outlinesRep.cacheKey, gltfPromise)
      }

      promises.push(
        gltfPromise
          .then((gltf) => createLineGeometryForGltf(gltf, outlinesRep.representation.selection, element))
          .catch(() => {
            console.error(`Failed to load outlines for element ${element.urn}`)
            return undefined
          })
          .then((geometry) => {
            if (geometry && geometry.attributes.position.count > 0) {
              geometry.name = `${system} - ${elementId.split("-").slice(-1).join("-")} - ${revision} - outlines`
              if (!representations.outlinesGeometry) representations.outlinesGeometry = new Map()
              representations.outlinesGeometry.set(element.urn, geometry)
            }
          }),
      )
    }

    const footprintRep = getRepresentationAndCacheKey(element, "footprint")
    const localRepresentation = elementsystem?.customFetchFootprint?.(element)

    if (footprintRep) {
      let footprintPromise = footprintCache.get(footprintRep.cacheKey)

      if (!footprintPromise) {
        footprintPromise = loadRepresentationJson<FeatureCollection>(
          element.urn,
          localRepresentation ?? footprintRep.representation,
          getElementsClient(),
        ).catch((e) => {
          console.error(`Failed to load footprint for element ${element.urn}`)
          throw e
        })
        footprintCache.set(footprintRep.cacheKey, footprintPromise)
      }

      promises.push(
        footprintPromise.then((featureCollection) => {
          const selection = footprintRep.representation.selection
          if (!selection || selection.type !== "equals") {
            console.warn(
              `Unexpected selection for footprint (${JSON.stringify(selection ?? "missing")}) - element urn: ${element.urn}`,
            )
          }
          const predicate = createSelectionPredicate(selection)

          const feature = featureCollection.features.find((f) => (f.id ? predicate(f.id as string) : false))
          if (feature) {
            representations.footprint.set(element.urn, feature)
          }
        }),
      )
    }

    const terrainShapeRep = getRepresentationAndCacheKey(element, "terrainShape")

    if (terrainShapeRep) {
      let promise = terrainShapeCache.get(terrainShapeRep.cacheKey)

      if (!promise) {
        promise = (async () => {
          const result = await loadRepresentationJson(
            element.urn,
            elementsystem?.customFetchTerrainShape?.(element) ?? terrainShapeRep.representation,
            getElementsClient(),
          )

          // Temporary workaround until we figure out a proper solution for
          // https://spacemakercore.slack.com/archives/C05SLC5QU5A/p1709844047585809?thread_ts=1709811622.370789&cid=C05SLC5QU5A
          // https://spacemakercore.slack.com/archives/C01DQHS3N0M/p1709909070448359?thread_ts=1709905383.179379&cid=C01DQHS3N0M
          if (system === "integrate") {
            result.features.forEach((feature) => {
              // Ensure LineString has stroke.
              if (feature.geometry.type === "LineString" && feature?.properties?.stroke?.["lineWidth"] == null) {
                feature.properties = {
                  ...feature?.properties,
                  stroke: {
                    ...feature?.properties?.stroke,
                    lineWidth: 1,
                  },
                }
              }
              // Ensure Polygon has fill.
              if (feature.geometry.type === "Polygon" && feature.properties?.fill?.["color"] == null) {
                feature.properties = {
                  ...feature?.properties,
                  fill: {
                    ...feature?.properties?.fill,
                    color: "#555555",
                  },
                }
              }
            })
          }

          return result
        })().catch((e) => {
          console.error(`Failed to load terrainShape for element ${element.urn}`)
          throw e
        })

        terrainShapeCache.set(terrainShapeRep.cacheKey, promise)
      }

      const selectionPredicate = terrainShapeRep.representation.selection
        ? createSelectionPredicate(terrainShapeRep.representation.selection)
        : undefined

      promises.push(
        promise.then((featureCollection) => {
          representations.terrainShape.set(
            element.urn,
            selectionPredicate
              ? {
                  ...featureCollection,
                  features: featureCollection.features.filter(
                    (f) => typeof f.id === "string" && selectionPredicate(f.id),
                  ),
                }
              : featureCollection,
          )
        }),
      )
    }
    const terrainTextureRep = getRepresentationAndCacheKey(element, "terrainTexture")
    if (terrainTextureRep) {
      let terrainTexturePromise = terrainTextureCache.get(terrainTextureRep.cacheKey)

      if (!terrainTexturePromise) {
        terrainTexturePromise = loadRepresentationBinary(
          element.urn,
          terrainTextureRep.representation,
          getElementsClient(),
        ).then((image) => {
          const terrainTexture: TerrainTexture = {
            cacheKey: terrainTextureRep.cacheKey,
            image: image,
            properties: terrainTextureRep.representation.properties,
          } as TerrainTexture

          return terrainTexture
        })
        terrainTextureCache.set(terrainTextureRep.cacheKey, terrainTexturePromise)
      }

      promises.push(
        terrainTexturePromise.then((terrainTexture) => {
          representations.terrainTexture.set(element.urn, terrainTexture)
        }),
      )
    }
    const buildingFloors3DSketchRepresentation = getRepresentationAndCacheKey(
      element,
      "buildingFloors3DSketch_UNSTABLE",
    )
    if (buildingFloors3DSketchRepresentation) {
      let promise = buildingFloors3DSketchCache.get(buildingFloors3DSketchRepresentation.cacheKey)
      if (!promise) {
        promise = loadRepresentationJson(
          element.urn,
          buildingFloors3DSketchRepresentation.representation,
          getElementsClient(),
        ).catch((e) => {
          console.error(`Failed to load buildingFloors3DSketch_UNSTABLE for element ${element.urn}`)
          throw e
        })
        buildingFloors3DSketchCache.set(buildingFloors3DSketchRepresentation.cacheKey, promise)
      }
      promises.push(
        promise.then((building) => {
          representations.buildingFloors3DSketch_UNSTABLE.set(element.urn, building)
        }),
      )
    }
  }

  await Promise.all(promises)

  performance.measure("getRepresentationsByUrn", {
    start,
  })

  return representations
}

const _identity = new Matrix4()

export function flipYUpToZUp(geometry: BufferGeometry) {
  const position = geometry.attributes.position.array as Float32Array
  const normal = geometry.attributes.normal.array as Float32Array
  let tmp: number
  for (let i = 0; i < position.length; i += 3) {
    tmp = position[i + 2]
    position[i + 2] = position[i + 1]
    position[i + 1] = -tmp
    tmp = normal[i + 2]
    normal[i + 2] = normal[i + 1]
    normal[i + 1] = -tmp
  }
  if (geometry.boundingSphere) {
    const center = geometry.boundingSphere.center
    tmp = center.z
    center.z = center.y
    center.y = -tmp
  }
}

const prepareGeometryForExtraction = (mesh: Mesh): BufferGeometry => {
  mesh.updateMatrixWorld()
  const child: Mesh = new Mesh(mesh.geometry.clone(), (mesh.material as Material).clone())
  if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals()
  if (!mesh.matrixWorld.equals(_identity)) child.geometry.applyMatrix4(mesh.matrixWorld)
  flipYUpToZUp(child.geometry)
  if (child.geometry.index) child.geometry = child.geometry.toNonIndexed()
  return child.geometry
}

const extractGeometry = (mesh: Mesh) => {
  const geometry = prepareGeometryForExtraction(mesh)

  const color = geometry.attributes.color
  const colors = new Uint8Array(geometry.attributes.position.count * 3)
  const white = new Color(1, 1, 1)
  if (color) {
    let result = color.array
    if (color.array instanceof Uint16Array) {
      result = Uint8Array.from(color.array, (v) => v >> 8)
    } else if (color.array instanceof Float32Array) {
      result = Uint8Array.from(color.array, (v) => v * 0xff)
    }
    if (color.itemSize === 3) {
      colors.set(result)
    } else {
      for (let i = 0; i < result.length / 4; i++) {
        colors[i * 3] = result[i * 4]
        colors[i * 3 + 1] = result[i * 4 + 1]
        colors[i * 3 + 2] = result[i * 4 + 2]
      }
    }
  } else {
    const src = (mesh.material as MeshStandardMaterial).color || white
    const array = Uint8Array.from(src.toArray(), (v) => v * 0xff)
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      colors.set(array, i * 3)
    }
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true))

  return geometry
}

const finishGeometry = (geo: BufferGeometry, doubleSided: boolean) => {
  if (doubleSided) geo.userData = { doubleSided: true }
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

const validateSelectionAndGetObject = (
  gltf: GLTF,
  selection: RepresentationSelection | undefined,
  element: FormaElement,
) => {
  if (selection && selection?.type !== "equals") {
    throw new Error(`Only equals selection is supported for volume mesh - found ${JSON.stringify(selection)}`)
  }

  const objectByName = selection ? gltf.scene.getObjectByName(selection.value) : undefined
  if (selection && !objectByName) {
    console.error(
      `Bad geometry representation in element, element in gltf does not have element named ${selection.value}`,
      element,
      gltf.scene,
    )
    throw new Error(`Bad gltf in element data - GLTF does not contain node with id: ${selection.value}`)
  }

  return objectByName ?? gltf.scene
}

function createLineGeometryForGltf(
  gltf: GLTF,
  selection: RepresentationSelection | undefined,
  element: FormaElement,
): BufferGeometry | undefined {
  const sceneObject = validateSelectionAndGetObject(gltf, selection, element)

  if (sceneObject instanceof Mesh || sceneObject instanceof LineSegments) {
    if ((sceneObject.geometry as BufferGeometry).attributes.position?.count > 0) {
      const geometry = (sceneObject.geometry as BufferGeometry).clone()
      if (!sceneObject.matrixWorld.equals(_identity)) {
        geometry.applyMatrix4(sceneObject.matrixWorld)
      }
      geometry.applyMatrix4(yUpToZUp)
      geometry.name = element.urn
      return geometry
    }
  }

  return undefined
}

function createCombinedAndSplitGeometriesForGltf(
  gltf: GLTF,
  selection: RepresentationSelection | undefined,
  element: FormaElement,
): {
  combinedGeometry: BufferGeometry | undefined
  splitResult: { opaque?: BufferGeometry; transparent?: BufferGeometry }
} {
  const sceneObject = validateSelectionAndGetObject(gltf, selection, element)

  const result = mergeGroupWithSplit(sceneObject)

  const combinedGeometry = extractGeometry(result.combined)

  const splitResult: { opaque?: BufferGeometry; transparent?: BufferGeometry } = {}

  if (result.opaque && result.opaque.geometry.attributes.position.count > 0) {
    splitResult.opaque = finishGeometry(
      prepareGeometryForExtraction(new Mesh(result.opaque.geometry)),
      result.opaque.doubleSided,
    )
  }

  if (result.transparent && result.transparent.geometry.attributes.position.count > 0) {
    splitResult.transparent = finishGeometry(
      prepareGeometryForExtraction(new Mesh(result.transparent.geometry)),
      result.transparent.doubleSided,
    )
  }

  return { combinedGeometry, splitResult }
}

function handleVolumeMeshError(e: unknown, element: FormaElement): BufferGeometry {
  const result = new BoxGeometry(10.0001, 10.0001, 10.0001).toNonIndexed()
  result.computeBoundingBox()
  result.computeBoundingSphere()
  setGeometryColor(new Color("#ff00ff"), result)
  captureLogAndToast(e, "Failed to download geometry for " + parseUrn(element.urn).system + " element")
  return result
}
