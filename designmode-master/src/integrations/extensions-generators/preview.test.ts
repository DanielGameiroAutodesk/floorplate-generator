import type { Feature, GeoJsonProperties, LineString, Polygon } from "geojson"
import type { Object3D } from "three"
import { BufferGeometry, Matrix4, Mesh, Vector3 } from "three"
import { describe, expect, test } from "vitest"
import { generatorResultToRenderable } from "./preview"

const linearRing = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 0],
]

function createPolygonFeature(properties: GeoJsonProperties): Feature<Polygon> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [linearRing],
    },
  }
}

function createLineStringFeature(properties: GeoJsonProperties): Feature<LineString> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "LineString",
      coordinates: linearRing,
    },
  }
}

function getBufferGeometry(object: Object3D): BufferGeometry {
  if (!(object instanceof Mesh)) {
    console.error(object)
    throw new Error("Expected Mesh")
  }

  const geometry = object.geometry
  if (!(geometry instanceof BufferGeometry)) {
    console.error(geometry)
    throw new Error("Expected BufferGeometry")
  }

  return geometry
}

function getColor(bufferGeometry: BufferGeometry) {
  const list = bufferGeometry.attributes.color.array
  return [list[0], list[1], list[2], list[3]]
}

const defaultTransform = new Matrix4()

describe("Renderable for preview", () => {
  describe("Polygon", () => {
    test("Should give expected default fill color", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [createPolygonFeature({})],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(1)

      const geometry = getBufferGeometry(result.children[0])
      expect(getColor(geometry)).toStrictEqual([23, 23, 23, 127])
    })

    test("Should map fill color", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createPolygonFeature({
                fill: "#112233",
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(1)

      const geometry = getBufferGeometry(result.children[0])
      expect(getColor(geometry)).toStrictEqual([1, 4, 8, 127])
    })

    test("Should map fill opacity", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createPolygonFeature({
                fill: "#112233",
                "fill-opacity": 0.75,
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(1)

      const geometry = getBufferGeometry(result.children[0])
      expect(getColor(geometry)).toStrictEqual([1, 4, 8, 191])
    })

    test("Should support stroke (outline)", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createPolygonFeature({
                fill: "#111111",
                stroke: "#121212",
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(2)

      const polygon = getBufferGeometry(result.children[0])
      expect(getColor(polygon)).toStrictEqual([1, 1, 1, 127])

      const outline = getBufferGeometry(result.children[1])
      expect(getColor(outline)).toStrictEqual([1, 1, 1, 255])
    })

    test("Should support stroke width", () => {
      const small = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createPolygonFeature({
                stroke: "#121212",
                "stroke-width": 1,
              }),
            ],
          },
        },
        defaultTransform,
      )
      const large = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createPolygonFeature({
                stroke: "#121212",
                "stroke-width": 100,
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!small) throw new Error("Missing small")
      if (!large) throw new Error("Missing large")

      expect(small.children.length).toBe(2)
      expect(large.children.length).toBe(2)

      const smallOutline = getBufferGeometry(small.children[1])
      const largeOutline = getBufferGeometry(large.children[1])

      expect(smallOutline.boundingSphere?.radius).toBeLessThan(50)
      expect(largeOutline.boundingSphere?.radius).toBeGreaterThan(50)
    })

    test("Should support multiple polygons", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [createPolygonFeature({}), createPolygonFeature({})],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(2)
    })

    test("Applies transform", () => {
      const vector = new Vector3(1, 0, 0)
      const transform = new Matrix4().setPosition(vector)

      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [createPolygonFeature({})],
          },
        },
        transform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(1)

      const geometry = getBufferGeometry(result.children[0])
      const positions = Array.from(geometry.attributes.position.array)

      expect(positions).toStrictEqual([11, 10, 0, 1, 0, 0, 11, 0, 0])
    })
  })

  describe("LineString", () => {
    test("Should map stroke color", () => {
      const result = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createLineStringFeature({
                stroke: "#112233",
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!result) throw new Error("Missing result")
      expect(result.children.length).toBe(1)

      const geometry = getBufferGeometry(result.children[0])
      expect(getColor(geometry)).toStrictEqual([1, 4, 8, 127])
    })

    test("Should map stroke width", () => {
      const small = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createLineStringFeature({
                "stroke-width": 1,
              }),
            ],
          },
        },
        defaultTransform,
      )
      const large = generatorResultToRenderable(
        {
          geojson: {
            type: "FeatureCollection",
            features: [
              createLineStringFeature({
                "stroke-width": 100,
              }),
            ],
          },
        },
        defaultTransform,
      )
      if (!small) throw new Error("Missing small")
      if (!large) throw new Error("Missing large")

      expect(small.children.length).toBe(1)
      expect(large.children.length).toBe(1)

      const smallOutline = getBufferGeometry(small.children[0])
      const largeOutline = getBufferGeometry(large.children[0])

      expect(smallOutline.boundingSphere?.radius).toBeLessThan(50)
      expect(largeOutline.boundingSphere?.radius).toBeGreaterThan(50)
    })
  })
})
