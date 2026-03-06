import { describe, expect, it } from "vitest"
import graph from "./graph"
import traversal from "./traversal"
import graphInternal from "./graph-internal"
import type { CoEdgeProperties, EdgeProperties } from "src/integrations/composition-site-graph/state"
import { isDefined } from "src/lib/array"
import type { Graph } from "./types"
import { objectKeys } from "src/lib/record"

describe("graph", () => {
  describe("empty", () => {
    it("should be empty", () => {
      const g = graph.empty()

      expect(g.vertices).toEqual({})
      expect(g.edges).toEqual({})

      expect(g._vertices).toEqual({})
      expect(g._edges).toEqual({})
      expect(g._coEdges).toEqual({})
    })
  })
  describe("addVertex", () => {
    const g0 = graph.empty()
    const [g1, v0] = graph.addVertex(g0, 0, 0)
    it("should add vertex", () => {
      expect(g1.vertices[v0]).toBeDefined()
    })
    it("should add internal vertices which matches original vertices", () => {
      expect(g1._vertices[v0]).toBeDefined()
      expect(g1._vertices[v0].type).toEqual("vertex")
    })
    it("should keep id", () => {
      expect(g0.id).equals(g1.id)
    })
  })

  describe("addEdge", () => {
    describe("add single edge", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, 0, 0)
      const [g2, v1] = graph.addVertex(g1, 1, 0)
      const [g3, e0] = graph.addEdge(g2, v0, v1)
      it("should add edge", () => {
        expect(g3.edges[e0]).toBeDefined()
      })
      it("should keep id", () => {
        expect(g0.id).equals(g3.id)
      })
    })
    describe("adding intersecting edges", () => {
      it("should insert internal vertices", () => {
        const g0 = graph.empty()
        const [g1, v0] = graph.addVertex(g0, -1, 0)
        const [g2, v1] = graph.addVertex(g1, 1, 0)
        const [g3, v2] = graph.addVertex(g2, 0, -1)
        const [g4, v3] = graph.addVertex(g3, 0, 1)
        const [g5] = graph.addEdge(g4, v0, v1)
        const [g6] = graph.addEdge(g5, v2, v3)
        expect(objectKeys(g6.vertices)).toHaveLength(4)
        expect(objectKeys(g6._vertices)).toHaveLength(5)
      })
      it("should insert internal edges", () => {
        const g0 = graph.empty()
        const [g1, v0] = graph.addVertex(g0, -1, 0)
        const [g2, v1] = graph.addVertex(g1, 1, 0)
        const [g3, v2] = graph.addVertex(g2, 0, -1)
        const [g4, v3] = graph.addVertex(g3, 0, 1)
        const [g5, e0] = graph.addEdge(g4, v0, v1)
        const [g6, e1] = graph.addEdge(g5, v2, v3)
        expect(g6.edges[e0]).toBeDefined()
        expect(g6.edges[e1]).toBeDefined()
        expect(objectKeys(g6.edges)).toHaveLength(2)
        expect(objectKeys(g6._edges)).toHaveLength(4)
      })
      it("should copy properties on _edge when splitting _edge", () => {
        const g0 = graph.empty<EdgeProperties>()
        const [g1, v0] = graph.addVertex(g0, -1, 0)
        const [g2, v1] = graph.addVertex(g1, 1, 0)
        const [g3, v2] = graph.addVertex(g2, 0, -1)
        const [g4, v3] = graph.addVertex(g3, 0, 1)
        const [g5] = graph.addEdge(g4, v0, v1)

        const edgeId = objectKeys(g5._edges)[0]
        const g6 = graph.setPropertiesOnEdge(g5, edgeId, { road: { type: "road", width: 42, path: "" } })

        const [g7] = graph.addEdge(g6, v2, v3)

        const internalEdgesWithProperties = Object.values(g7._edges)
          .map((edge) => edge.properties)
          .filter(isDefined)

        expect(internalEdgesWithProperties).toHaveLength(2)
      })
      it("should copy properties on _coEdge when splitting _coEdge", () => {
        const g0 = graph.empty<any, CoEdgeProperties>()
        const [g1, v0] = graph.addVertex(g0, -1, 0)
        const [g2, v1] = graph.addVertex(g1, 1, 0)
        const [g3, v2] = graph.addVertex(g2, 0, -1)
        const [g4, v3] = graph.addVertex(g3, 0, 1)
        const [g5] = graph.addEdge(g4, v0, v1)

        const coEdgeId = objectKeys(g5._coEdges)[0]
        const g6 = graph.setPropertiesOnCoEdge(g5, coEdgeId, { parcels: true })

        const [g7] = graph.addEdge(g6, v2, v3)

        const coEdgesWithProperties = Object.values(g7._coEdges)
          .map((edge) => edge.properties)
          .filter(isDefined)

        expect(coEdgesWithProperties).toHaveLength(2)
        expect(g7.id).equals(g0.id)
      })
    })
  })
  describe("removeEdge", () => {
    const g0 = graph.empty()
    const [g1, v0] = graph.addVertex(g0, 0, 0)
    const [g2, v1] = graph.addVertex(g1, 1, 0)
    const [g3, v2] = graph.addVertex(g2, 1, 1)
    const [g4, e0] = graph.addEdge(g3, v0, v1)
    const [g5, e1] = graph.addEdge(g4, v1, v2)
    const [g6] = graph.addEdge(g5, v2, v0)
    it("should remove edge and its internal edge", () => {
      expect(g6.edges[e0]).toBeDefined()
      const g7 = graphInternal._removeEdge(g6, e0)
      expect(g7.edges[e0]).toBeUndefined()
      expect(g7.edges[e1]).toBeDefined()
      const g8 = graphInternal._updateInternals(g7, [e0])
      expect(Object.values(g8._edges).find((edge) => edge.superEdgeId === e0)).toBeUndefined()
    })
    it("should remove coEdge if edge is part of coEdge", () => {
      expect(Object.values(g6._coEdges).find((coEdge) => g6._edges[coEdge.edgeId].superEdgeId === e0)).toBeDefined()
      const g7 = graphInternal._removeEdge(g6, e0)
      const g8 = graphInternal._updateInternals(g7, [e0])
      expect(Object.values(g8._coEdges).find((coEdge) => g8._edges[coEdge.edgeId].superEdgeId === e0)).toBeUndefined()
    })
    it("should remove loop if edge is part of loop", () => {
      expect(Object.entries(g6._loops)).toHaveLength(2)
      const g7 = graphInternal._removeEdge(g6, e0)
      const g8 = graphInternal._updateInternals(g7, [e0])
      expect(Object.entries(g8._loops)).toHaveLength(1)
    })
  })
  describe("removeVertex", () => {
    const g0 = graph.empty()
    const [g1, v0] = graph.addVertex(g0, 0, 0)
    const [g2, v1] = graph.addVertex(g1, 1, 0)
    const [g3, v2] = graph.addVertex(g2, 1, 1)
    const [g4] = graph.addEdge(g3, v0, v1)
    const [g5] = graph.addEdge(g4, v1, v2)
    //const [g6] = graph.addEdge(g5, v2, v0)
    it("should remove vertex and its internal vertex", () => {
      expect(g5._vertices[v2]).toBeDefined()
      const [removedVertexGraph] = graph.removeVertex(g5, v2)
      expect(removedVertexGraph).toBeDefined()
      expect(removedVertexGraph.vertices[v2]).toBeUndefined()
      expect(removedVertexGraph._vertices[v2]).toBeUndefined()
    })
    it("should remove edge if vertex is part of edge", () => {
      expect(g5.edges).toBeDefined()
      const [removedVertexGraph] = graph.removeVertex(g5, v2)
      expect(removedVertexGraph).toBeDefined()
      expect(
        Object.values(removedVertexGraph.edges).find((edge) => edge.start === v2 || edge.end === v2),
      ).toBeUndefined()
    })
    it("should remove internal edge if vertex is part of edge", () => {
      expect(g5._edges).toBeDefined()
      const [removedVertexGraph] = graph.removeVertex(g5, v2)
      expect(removedVertexGraph).toBeDefined()
      expect(
        Object.values(removedVertexGraph._edges).find((edge) => edge.start === v2 || edge.end === v2),
      ).toBeUndefined()
    })
    it("should remove orphaned vertex if other vertex (and its edge) is removed", () => {
      const [simpleGraph] = graph.addEdge(g2, v0, v1)
      const [removedVertexGraph] = graph.removeVertex(simpleGraph, v1)
      expect(removedVertexGraph).toBeDefined()
      expect(removedVertexGraph.vertices[v0]).toBeUndefined()
      expect(removedVertexGraph._vertices[v0]).toBeUndefined()
    })
    describe("if vertex is part of two edges", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, 0, 0)
      const [g2, v1] = graph.addVertex(g1, 2, 0)
      const [g3, v2] = graph.addVertex(g2, 2, 1)
      const [g4, longEdgeId] = graph.addEdge(g3, v0, v1)
      const [g5, shortEdgeId] = graph.addEdge(g4, v1, v2)
      it("should connect edges if vertex is part of two edges", () => {
        const [removedVertexGraph] = graph.removeVertex(g5, v1)
        expect(removedVertexGraph).toBeDefined()
        expect(removedVertexGraph.edges).toBeDefined()
        expect(Object.values(removedVertexGraph.edges)).toHaveLength(1)
        expect(Object.values(removedVertexGraph.edges)[0].start).toEqual(v0)
        expect(Object.values(removedVertexGraph.edges)[0].end).toEqual(v2)
      })
      it("should keep properties of removed edges around", () => {
        const internalLongEdgeId = Object.entries(g5._edges).find(([, edge]) => edge.superEdgeId === longEdgeId)![0]
        const internalShortEdgeId = Object.entries(g5._edges).find(([, edge]) => edge.superEdgeId === shortEdgeId)![0]
        const g6 = graph.setPropertiesOnEdge(g5, internalLongEdgeId, { someProps: true })
        const g7 = graph.setPropertiesOnEdge(g6, internalShortEdgeId, { otherProps: true })
        const [g8] = graph.removeVertex(g7, v1)
        expect(g8).toBeDefined()
        expect(g8.edges).toBeDefined()
        expect(Object.values(g8._edges)).toHaveLength(1)
        expect(Object.values(g8._edges)[0].properties).toBeDefined()
        expect(Object.values(g8._edges)[0].properties!.someProps).toEqual(true)
      })
    })
  })
  describe("moveVertex", () => {
    it("should keep inserted vertexId", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, -1, 0)
      const [g2, v1] = graph.addVertex(g1, 1, 0)
      const [g3, v2] = graph.addVertex(g2, 0, -1)
      const [g4, v3] = graph.addVertex(g3, 0, 1)
      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v2, v3)

      const insertedVertex = objectKeys(g6._vertices).find((vertexId) => g6._vertices[vertexId].type === "intersection")
      expect(insertedVertex).toBeDefined()

      const [g7] = graph.moveVertex(g6, v3, 1, 1)

      expect(g7._vertices[insertedVertex!]).toBeDefined()
      expect(g0.id).equals(g7.id)
    })
    it("should keep inserted edgeIds", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, -1, 0)
      const [g2, v1] = graph.addVertex(g1, 1, 0)
      const [g3, v2] = graph.addVertex(g2, 0, -1)
      const [g4, v3] = graph.addVertex(g3, 0, 1)
      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v2, v3)

      const [g7] = graph.moveVertex(g6, v3, 1, 1)

      for (let edgeId of objectKeys(g6._edges)) {
        expect(g7._edges[edgeId]).toBeDefined()
      }
      for (let edgeId of objectKeys(g7._edges)) {
        expect(g6._edges[edgeId]).toBeDefined()
      }
    })
    it("should keep properties on polygons that are still there", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, -1, -1)
      const [g2, v1] = graph.addVertex(g1, 1, -1)
      const [g3, v2] = graph.addVertex(g2, 1, 1)
      const [g4, v3] = graph.addVertex(g3, -1, 1)
      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v1, v2)
      const [g7] = graph.addEdge(g6, v2, v3)
      const [g8] = graph.addEdge(g7, v3, v0)
      const polygon = objectKeys(g8._polygons)[0]
      const g9 = graph.setPropertiesOnPolygon(g8, polygon, { vegetationProperties: 2 })
      const [g10] = graph.moveVertex(g9, v3, 0, 0)
      const movedPolyId = objectKeys(g10._polygons)[0]
      const polyProperties = g10._polygons[movedPolyId].properties
      expect(polyProperties).toBeDefined()
      expect(polyProperties["vegetationProperties"]).toEqual(2)
    })

    it("should remove intersection", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, -1, 0)
      const [g2, v1] = graph.addVertex(g1, 1, 0)
      const [g3, v2] = graph.addVertex(g2, 0, -1)
      const [g4, v3] = graph.addVertex(g3, 0, 1)
      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v2, v3)

      const [g7] = graph.moveVertex(g6, v3, 3, 1)

      expect(objectKeys(g7._vertices)).toHaveLength(4)
      expect(objectKeys(g7._edges)).toHaveLength(2)
    })
    it("should add intersection", () => {
      const g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, -1, 0)
      const [g2, v1] = graph.addVertex(g1, 1, 0)
      const [g3, v2] = graph.addVertex(g2, 0, -1)
      const [g4, v3] = graph.addVertex(g3, 3, 1)
      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v2, v3)

      const [g7] = graph.moveVertex(g6, v3, 0, 1)

      expect(objectKeys(g7._vertices)).toHaveLength(5)
      expect(objectKeys(g7._edges)).toHaveLength(4)
    })
  })

  describe("traversal", () => {
    it("should find next coEdges for vertexId", () => {
      let g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, 0, 0)
      const [g2, v1] = graph.addVertex(g1, 5, 0)
      const [g3, v2] = graph.addVertex(g2, 1, -4)

      const [g4] = graph.addEdge(g3, v0, v1)
      const [g5] = graph.addEdge(g4, v1, v2)
      const [g6] = graph.addEdge(g5, v2, v0)

      expect(traversal._findCoEdgesLeavingVertexId(g6, v0)).toHaveLength(2)
      expect(traversal._findCoEdgesLeavingVertexId(g6, v1)).toHaveLength(2)
      expect(traversal._findCoEdgesLeavingVertexId(g6, v2)).toHaveLength(2)
    })
    it("should add loops and polygons", () => {
      let g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, 0, 0)
      const [g2, v1] = graph.addVertex(g1, 5, 0)
      const [g3, v2] = graph.addVertex(g2, 1, -4)

      const [g4] = graph.addEdge(g3, v0, v1)
      const [g5] = graph.addEdge(g4, v1, v2)
      const [g6] = graph.addEdge(g5, v2, v0)

      expect(objectKeys(g6._loops)).toHaveLength(2)
      expect(objectKeys(g6._polygons)).toHaveLength(1)
    })
    it("adding a diamond should get correct loops and polygons", () => {
      let g0 = graph.empty()
      const [g1, v0] = graph.addVertex(g0, 1, 0)
      const [g2, v1] = graph.addVertex(g1, 2, 1)
      const [g3, v2] = graph.addVertex(g2, 1, 2)
      const [g4, v3] = graph.addVertex(g3, 0, 1)

      const [g5] = graph.addEdge(g4, v0, v1)
      const [g6] = graph.addEdge(g5, v1, v2)
      const [g7] = graph.addEdge(g6, v2, v3)
      const [g8] = graph.addEdge(g7, v3, v0)
      const [g9] = graph.addEdge(g8, v2, v0)

      expect(objectKeys(g9._loops)).toHaveLength(3)
      expect(objectKeys(g9._polygons)).toHaveLength(2)
    })
  })

  describe("split edge", () => {
    const g0 = graph.empty()
    const [g1, v0] = graph.addVertex(g0, 0, 0)
    const [g2, v1] = graph.addVertex(g1, 1, 0)
    const [g3, e0] = graph.addEdge(g2, v0, v1)
    const internalEdgeToSplit = Object.entries(g3._edges).find(([, edge]) => edge.superEdgeId === e0)![0]
    const [g4, v2] = graph.addVertex(g3, 1, 1)
    const [g5] = graph.addEdge(g4, v1, v2)
    const [g6] = graph.addEdge(g5, v2, v0)
    const testProps = { test: true }
    const g7 = graph.setPropertiesOnEdge(g6, internalEdgeToSplit, testProps)
    const coEdgeWithE0 = Object.entries(g7._coEdges).find(([, coEdge]) => g7._edges[coEdge.edgeId].superEdgeId === e0)
    const g8 = graph.setPropertiesOnCoEdge(g7, coEdgeWithE0![0], testProps)
    const [g9, edges] = graph.splitEdge(g8, internalEdgeToSplit, { x: 0.5, y: 0 })
    it("should create two new edges in place of split edge", () => {
      expect(objectKeys(g9.edges)).toHaveLength(4)
    })
    it("should create two new internal edges in place of split edge", () => {
      expect(objectKeys(g9._edges)).toHaveLength(4)
    })
    it("should create two new coEdges in place of split edge", () => {
      expect(objectKeys(g9._coEdges)).toHaveLength(8)
    })
    describe("should keep properties", () => {
      it("on new edges", () => {
        expect(g9.edges[edges[0]].properties).toEqual(g8.edges[e0].properties)
        expect(g9.edges[edges[1]].properties).toEqual(g8.edges[e0].properties)
      })
      it("on new internal edges", () => {
        const internalEdgesForEdgeAfterSplit = Object.entries(g9._edges).filter(
          ([, edge]) => edge.superEdgeId === edges[0] || edge.superEdgeId === edges[1],
        )
        internalEdgesForEdgeAfterSplit.forEach(([, edge]) => {
          expect(edge.properties).equals(testProps)
        })
      })
    })
    it("should keep properties on new coEdges", () => {
      /**
       * Illustration of split with kept properties:
       * rh: rowhouse parameters, v: vegetation parameters
       * o: vertex, x: intersection, |: edge
       *      o                                       o
       *      |                                       |
       *   rh |  v                                 rh | v  v
       * o----x-----o             =>             o----x--o--o
       *   v  |  rh                                v  |rh rh
       *      |                                       |
       *      o                                       o
       */

      const g: Graph = {
        id: "f818d4cd0bb9c",
        vertices: {
          "33334c4ec8edc": {
            x: -65.38933848546935,
            y: -5.331650857435749,
          },
          b3446668da7a2: {
            x: 52.002831142706874,
            y: -4.162993893469293,
          },
          "3fb1c9f9a9554": {
            x: -6.144301520113637,
            y: 38.74313993940249,
          },
          "237648c229718": {
            x: -5.998478372302023,
            y: -53.11788841313445,
          },
        },
        edges: {
          db0a81033fad4: {
            start: "33334c4ec8edc",
            end: "b3446668da7a2",
            properties: {},
          },
          "766927dfbf424": {
            start: "3fb1c9f9a9554",
            end: "237648c229718",
            properties: {},
          },
        },
        _edges: {
          dadf3689598a5: {
            start: "3fb1c9f9a9554",
            end: "e81a9b7a0bbde",
            superEdgeId: "766927dfbf424",
            properties: {},
          },
          "0361606349a98": {
            start: "e81a9b7a0bbde",
            end: "237648c229718",
            superEdgeId: "766927dfbf424",
            properties: {},
          },
          "8a7e0aa780612": {
            start: "33334c4ec8edc",
            end: "e81a9b7a0bbde",
            superEdgeId: "db0a81033fad4",
            properties: {},
          },
          "04b9d11b4dfee": {
            start: "e81a9b7a0bbde",
            end: "b3446668da7a2",
            superEdgeId: "db0a81033fad4",
            properties: {},
          },
        },
        _vertices: {
          "33334c4ec8edc": {
            x: -65.38933848546935,
            y: -5.331650857435749,
            type: "vertex",
          },
          b3446668da7a2: {
            x: 52.002831142706874,
            y: -4.162993893469293,
            type: "vertex",
          },
          "3fb1c9f9a9554": {
            x: -6.144301520113637,
            y: 38.74313993940249,
            type: "vertex",
          },
          "237648c229718": {
            x: -5.998478372302023,
            y: -53.11788841313445,
            type: "vertex",
          },
          e81a9b7a0bbde: {
            type: "intersection",
            x: -6.075273128955408,
            y: -4.741170284842141,
            intersection: {
              a: {
                id: "766927dfbf424",
                distanceFromStart: 0.47337060126699215,
              },
              b: {
                id: "db0a81033fad4",
                distanceFromStart: 0.5052642398925176,
              },
            },
          },
        },
        _coEdges: {
          c5b9de96fc849: {
            edgeId: "dadf3689598a5",
            reverse: false,
          },
          b62766ee4e13a: {
            edgeId: "dadf3689598a5",
            reverse: true,
          },
          "520c00432503b": {
            edgeId: "0361606349a98",
            reverse: false,
          },
          "3f9cb7b76f463": {
            edgeId: "0361606349a98",
            reverse: true,
          },
          "938779fc2ff19": {
            edgeId: "8a7e0aa780612",
            reverse: false,
            properties: {
              vegetationParameters: true,
            },
          },
          a523741271d8e: {
            edgeId: "8a7e0aa780612",
            reverse: true,
            properties: {
              rowHouseParameters: true,
            },
          },
          c15549efe2bef: {
            edgeId: "04b9d11b4dfee",
            reverse: false,
            properties: {
              rowHouseParameters: true,
            },
          },
          "5ca0e871adcf": {
            edgeId: "04b9d11b4dfee",
            reverse: true,
            properties: {
              vegetationParameters: true,
            },
          },
        },
        _loops: {
          aff096640af22: {
            coEdgeIds: [
              "c5b9de96fc849",
              "a523741271d8e",
              "938779fc2ff19",
              "520c00432503b",
              "3f9cb7b76f463",
              "c15549efe2bef",
              "5ca0e871adcf",
              "b62766ee4e13a",
            ],
          },
        },
        _polygons: {},
        _counter: 6,
      }
      //The left super edge will have 2 internal edges because of the intersection, the rightmost will have 1
      /**
       * o----x-----o             =>             o----x--o--o
       */
      const [splitGraph, [leftMostSuperEdge, rightMostSuperEdge]] = graph.splitEdge(g, "04b9d11b4dfee", {
        x: 30,
        y: -4,
      })
      const rightCoEdges = Object.entries(splitGraph._coEdges).filter(
        ([, coEdge]) => splitGraph._edges[coEdge.edgeId].superEdgeId === rightMostSuperEdge,
      )
      const topRightCoEdge = rightCoEdges.find(([, coEdge]) => coEdge.reverse)!
      const bottomRightCoEdge = rightCoEdges.find(([, coEdge]) => !coEdge.reverse)!
      expect(topRightCoEdge[1].properties).toEqual({ vegetationParameters: true })
      expect(bottomRightCoEdge[1].properties).toEqual({ rowHouseParameters: true })
      const [leftMostInternalEdge, middleInternalEdge] = objectKeys(splitGraph._edges).filter(
        (internalEdgeId) => splitGraph._edges[internalEdgeId].superEdgeId === leftMostSuperEdge,
      )
      const leftCoEdges = Object.entries(splitGraph._coEdges).filter(
        ([, coEdge]) => leftMostInternalEdge === coEdge.edgeId,
      )
      const topLeftCoEdge = leftCoEdges.find(([, coEdge]) => coEdge.reverse)!
      const bottomLeftCoEdge = leftCoEdges.find(([, coEdge]) => !coEdge.reverse)!
      expect(topLeftCoEdge[1].properties).toEqual({ rowHouseParameters: true })
      expect(bottomLeftCoEdge[1].properties).toEqual({ vegetationParameters: true })
      const middleCoEdges = Object.entries(splitGraph._coEdges).filter(
        ([, coEdge]) => middleInternalEdge === coEdge.edgeId,
      )
      const topMiddleCoEdge = middleCoEdges.find(([, coEdge]) => coEdge.reverse)!
      const bottomMiddleCoEdge = middleCoEdges.find(([, coEdge]) => !coEdge.reverse)!
      expect(topMiddleCoEdge[1].properties).toEqual({ vegetationParameters: true })
      expect(bottomMiddleCoEdge[1].properties).toEqual({ rowHouseParameters: true })
    })

    it("should stay loopy", () => {
      expect(objectKeys(g9._loops)).toHaveLength(2)
    })
  })

  describe("polygons", () => {
    it("don't contain polygons with area = 0", () => {
      const g = {
        ...graph.empty(),
        vertices: {
          "55a0ef5d7af26": {
            x: 96.5969476706077,
            y: -159.97545780761502,
          },
          d3dbfa2eab138: {
            x: -121.74870113883304,
            y: 65.35473491261186,
          },
          "43fda640d4228": {
            x: 85.25210496870841,
            y: -16.22612007098678,
          },
          "736ea6bed776": {
            x: -34.48737720695385,
            y: -189.20213350502073,
          },
        },
        edges: {
          e6107d9c9ae03: {
            start: "55a0ef5d7af26",
            end: "d3dbfa2eab138",
            properties: {
              road: {
                type: "road",
                width: 6,
              },
            },
          },
          f8ce2bc5f04cb: {
            start: "43fda640d4228",
            end: "736ea6bed776",
            properties: {
              road: {
                type: "road",
                width: 6,
              },
            },
          },
        },
      }
      const updatedGraph = graphInternal._updateInternals(g, objectKeys(g.edges))
      expect(objectKeys(updatedGraph._loops)).toHaveLength(1)
      expect(objectKeys(updatedGraph._polygons)).toHaveLength(0)
      expect(updatedGraph.id).equals(g.id)
    })
  })
  describe("error cases", () => {
    it("should work to add edge", () => {
      const g: Graph = {
        id: "7cd87f684af9f",
        vertices: {
          "1db99485929a9": {
            x: -136.56754047646658,
            y: 353.85975889812045,
          },
          ea2f99ec2c55: {
            x: -109.00577489685,
            y: 435.8616222903253,
          },
          "638440a9f86b8": {
            x: -57.49793729927541,
            y: 344.0894028909689,
          },
          "5d29a5e605009": {
            x: -158.44831948006467,
            y: 405.4166866884607,
          },
        },
        edges: {
          "659e8f8331f38": {
            start: "1db99485929a9",
            end: "ea2f99ec2c55",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          b0adbaa611ac7: {
            start: "ea2f99ec2c55",
            end: "638440a9f86b8",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          "4440a92e58741": {
            start: "638440a9f86b8",
            end: "5d29a5e605009",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
        },
        _edges: {
          bded6add89f2d: {
            start: "ea2f99ec2c55",
            end: "638440a9f86b8",
            superEdgeId: "b0adbaa611ac7",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          "0b2cf0d17fb88": {
            start: "638440a9f86b8",
            end: "27d3b47d75682",
            superEdgeId: "4440a92e58741",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          "4d0850c3ee042": {
            start: "27d3b47d75682",
            end: "5d29a5e605009",
            superEdgeId: "4440a92e58741",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          "99cc13bfd1215": {
            start: "1db99485929a9",
            end: "27d3b47d75682",
            superEdgeId: "659e8f8331f38",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
          "276037e7483db": {
            start: "27d3b47d75682",
            end: "ea2f99ec2c55",
            superEdgeId: "659e8f8331f38",
            properties: {
              road: {
                type: "road",
                width: 6,
                path: "root/f73a1b4",
              },
            },
          },
        },
        _vertices: {
          "1db99485929a9": {
            x: -136.56754047646658,
            y: 353.85975889812045,
            type: "vertex",
          },
          ea2f99ec2c55: {
            x: -109.00577489685,
            y: 435.8616222903253,
            type: "vertex",
          },
          "638440a9f86b8": {
            x: -57.49793729927541,
            y: 344.0894028909689,
            type: "vertex",
          },
          "5d29a5e605009": {
            x: -158.44831948006467,
            y: 405.4166866884607,
            type: "vertex",
          },
          "27d3b47d75682": {
            type: "intersection",
            x: -125.88723231018326,
            y: 385.63584990028465,
            intersection: {
              a: {
                id: "4440a92e58741",
                distanceFromStart: 0.6774545428508765,
              },
              b: {
                id: "659e8f8331f38",
                distanceFromStart: 0.3875044991378195,
              },
            },
          },
        },
        _coEdges: {
          e1c569d90b7e5: {
            edgeId: "bded6add89f2d",
            reverse: false,
          },
          "6ae28c6d95428": {
            edgeId: "bded6add89f2d",
            reverse: true,
          },
          "955d3257e292a": {
            edgeId: "0b2cf0d17fb88",
            reverse: false,
          },
          "7f590f9ac8a62": {
            edgeId: "0b2cf0d17fb88",
            reverse: true,
          },
          "40458754839f": {
            edgeId: "4d0850c3ee042",
            reverse: false,
          },
          aa822f2b3d70f: {
            edgeId: "4d0850c3ee042",
            reverse: true,
          },
          a2a82290dfff4: {
            edgeId: "99cc13bfd1215",
            reverse: false,
          },
          c508ab9a45443: {
            edgeId: "99cc13bfd1215",
            reverse: true,
          },
          "066988c392645": {
            edgeId: "276037e7483db",
            reverse: false,
          },
          "3ca7d9ff8d362": {
            edgeId: "276037e7483db",
            reverse: true,
          },
        },
        _loops: {
          b5a1f82958476: {
            coEdgeIds: ["e1c569d90b7e5", "955d3257e292a", "066988c392645"],
          },
          "92944b50b40e": {
            coEdgeIds: [
              "6ae28c6d95428",
              "3ca7d9ff8d362",
              "40458754839f",
              "aa822f2b3d70f",
              "c508ab9a45443",
              "a2a82290dfff4",
              "7f590f9ac8a62",
            ],
          },
        },
        _polygons: {
          "943974741563c": {
            loopIds: ["b5a1f82958476"],
          },
        },
        _counter: 7,
      }
      graph.addVertex(g, -158.44831948006467, 405.4166866884607)
    })
  })
})
