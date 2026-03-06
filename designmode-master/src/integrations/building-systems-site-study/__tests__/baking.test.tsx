import { describe, expect, test } from "vitest"
import { parkAreasToFeatures } from "src/integrations/building-systems-site-study/baking"
import type { ParkArea } from "src/integrations/building-systems-site-study/generator/siteStudySpec"

const siteStudy = {
  parkAreas: [
    {
      outerLimit: [
        [-3.6, -86.3],
        [62.2, -79.8],
        [79.9, -70],
        [84.4, -63.9],
        [86.18546042003234, -61.53295638126006],
        [83.2, -65.1],
        [20.3, -12.2],
        [-8.2, -40.4],
      ],
      buildingFootPrints: [
        [
          [-6.591549276210781, -56.44954091780981],
          [5.348639169295149, -55.25292072501401],
          [3.7401884455059307, -39.20337980720419],
          [-8.2, -40.4],
        ],
      ],
    },
  ] as ParkArea[],
  id: "d454167f5d69c",
}

describe("Baking trees", () => {
  test("should not crash on example 1", () => {
    expect(() => parkAreasToFeatures(siteStudy.parkAreas)).not.toThrow()
  })
})
