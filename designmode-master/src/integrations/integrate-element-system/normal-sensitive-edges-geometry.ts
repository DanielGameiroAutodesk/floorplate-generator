import { EdgesGeometry, MathUtils, Triangle, Vector3, Float32BufferAttribute } from "three"
import type { NormalBufferAttributes, BufferGeometry } from "three"

/**
 * This is a copy of the THREE.EdgesGeometry(geo: BufferGeometry) constructor
 * where the difference is it takes the normals of the geo into account.
 *
 * See original for reference: https://github.com/mrdoob/three.js/blob/master/src/geometries/EdgesGeometry.js
 *
 * The main difference is rather than use a computed normal based on the
 * triangles this uses the normals of the 2 vertices that make the edge
 */
export function generateEdgesGeometryNormalSensitive(
  geometry: BufferGeometry<NormalBufferAttributes>,
  thresholdAngle = 1,
): BufferGeometry<NormalBufferAttributes> {
  const _v0 = new Vector3()
  const _v1 = new Vector3()

  const _triangle = new Triangle()
  const _triangleNormals = new Triangle()

  const _matchedEdgeNormal0 = new Vector3()
  const _matchedEdgeNormal1 = new Vector3()

  const precisionPoints = 4
  const precision = Math.pow(10, precisionPoints)
  const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle)

  const indexAttr = geometry.getIndex()
  const positionAttr = geometry.getAttribute("position")
  const normalAttr = geometry.getAttribute("normal")
  const indexCount = indexAttr ? indexAttr.count : positionAttr.count

  const indexArr = [0, 0, 0]
  const vertKeys = ["a", "b", "c"]
  const hashes = new Array(3)

  // use the default THREE EdgesGeometry if no normals because the point of this custom utility
  // is to take normals into account which the default does not.
  if (!normalAttr || normalAttr.count !== positionAttr.count) {
    return new EdgesGeometry(geometry, thresholdAngle)
  }

  const edgeData: Record<string, { index0: number; index1: number } | null> = {}
  const vertices = []
  for (let i = 0; i < indexCount; i += 3) {
    if (indexAttr) {
      indexArr[0] = indexAttr.getX(i)
      indexArr[1] = indexAttr.getX(i + 1)
      indexArr[2] = indexAttr.getX(i + 2)
    } else {
      indexArr[0] = i
      indexArr[1] = i + 1
      indexArr[2] = i + 2
    }

    const { a, b, c } = _triangle
    a.fromBufferAttribute(positionAttr, indexArr[0])
    b.fromBufferAttribute(positionAttr, indexArr[1])
    c.fromBufferAttribute(positionAttr, indexArr[2])

    const { a: aNormal, b: bNormal, c: cNormal } = _triangleNormals
    aNormal.fromBufferAttribute(normalAttr, indexArr[0])
    bNormal.fromBufferAttribute(normalAttr, indexArr[1])
    cNormal.fromBufferAttribute(normalAttr, indexArr[2])

    // create hashes for the edge from the vertices
    hashes[0] = `${Math.round(a.x * precision)},${Math.round(a.y * precision)},${Math.round(a.z * precision)}`
    hashes[1] = `${Math.round(b.x * precision)},${Math.round(b.y * precision)},${Math.round(b.z * precision)}`
    hashes[2] = `${Math.round(c.x * precision)},${Math.round(c.y * precision)},${Math.round(c.z * precision)}`

    // skip degenerate triangles
    if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
      continue
    }

    // iterate over every edge
    for (let j = 0; j < 3; j++) {
      // get the first and next vertex making up the edge
      const jNext = (j + 1) % 3
      const vecHash0 = hashes[j]
      const vecHash1 = hashes[jNext]
      const v0 = _triangle[vertKeys[j] as "a" | "b" | "c"]
      const v1 = _triangle[vertKeys[jNext] as "a" | "b" | "c"]

      const hash = `${vecHash0}_${vecHash1}`
      const reverseHash = `${vecHash1}_${vecHash0}`

      if (reverseHash in edgeData && edgeData[reverseHash]) {
        const matchedEdge = edgeData[reverseHash]
        // if we found a sibling edge add it into the vertex array if
        // it meets the angle threshold and delete the edge from the map.

        _matchedEdgeNormal0.fromBufferAttribute(normalAttr, matchedEdge.index0)
        _matchedEdgeNormal1.fromBufferAttribute(normalAttr, matchedEdge.index1)

        if (
          _triangleNormals[vertKeys[jNext] as "a" | "b" | "c"].dot(_matchedEdgeNormal0) <= thresholdDot ||
          _triangleNormals[vertKeys[j] as "a" | "b" | "c"].dot(_matchedEdgeNormal1) <= thresholdDot
        ) {
          vertices.push(v0.x, v0.y, v0.z)
          vertices.push(v1.x, v1.y, v1.z)
        }

        edgeData[reverseHash] = null
      } else if (!(hash in edgeData)) {
        // if we've already got an edge here then skip adding a new one
        edgeData[hash] = {
          index0: indexArr[j],
          index1: indexArr[jNext],
        }
      }
    }
  }

  // iterate over all remaining, unmatched edges and add them to the vertex array
  for (const key in edgeData) {
    if (edgeData[key]) {
      const { index0, index1 } = edgeData[key]
      _v0.fromBufferAttribute(positionAttr, index0)
      _v1.fromBufferAttribute(positionAttr, index1)

      vertices.push(_v0.x, _v0.y, _v0.z)
      vertices.push(_v1.x, _v1.y, _v1.z)
    }
  }

  const edgeGeo = new EdgesGeometry()
  edgeGeo.setAttribute("position", new Float32BufferAttribute(vertices, 3))
  return edgeGeo
}
