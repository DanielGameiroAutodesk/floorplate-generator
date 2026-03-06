import {
  getBbox,
  pointInPolygon,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

function getRandomFloat(min, max) {
  return min + Math.random() * (max - min)
}

function samplePointInBbox(bbox) {
  return [getRandomFloat(bbox.xMin, bbox.xMax), getRandomFloat(bbox.yMin, bbox.yMax)]
}

export function samplePointInPolygon(polygon) {
  let bbox = getBbox([polygon])
  let point = samplePointInBbox(bbox)
  while (!pointInPolygon(point, polygon)) {
    point = samplePointInBbox(bbox)
  }
  return point
}
