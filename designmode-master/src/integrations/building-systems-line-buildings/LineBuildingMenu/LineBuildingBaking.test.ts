import { describe, it, expect } from "vitest"
import type {
  CirculationFeature,
  CustomFeature,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { getBakedLineBuildingParameters } from "./baking"
import type { SectionSelection } from "./types"

// The following set of parameters represents a "snaking" S-shaped line building with two 90-degree
// left turns followed by two 90-degree right turns. For each pair of turns, one of them has a
// longer right-leg than left-leg, and the other has the opposite. This means we are able to test
// all 4 possible combinations of (left/right leg is longest) x (positive/negative turn angle)
//        __
//    |  |  |
//    |__|  |

const CIRCULATION_FEATURE: CirculationFeature = {
  name: "Circulation",
  settings: { corridorWidth: { value: 2 }, corridorAlignment: { value: "right" } },
}

const LINE_BUILDING_PARAMETERS: LineBuildingParameters = {
  width: 12,
  floorHeight: 3,
  numberOfFloors: 4,
  minSubBuildingLength: 16,
  lineAlignment: "center",
  customLayouts: [],
  sectionToggle: true,
  graph: {
    vertices: {
      "ae05cb21-1dde-4644-9028-59eef1d0cb4d": {
        x: -34.625183713722386,
        y: -125.61367696594736,
        id: "ae05cb21-1dde-4644-9028-59eef1d0cb4d",
      },
      "e69391bf-c9b2-4e84-9145-316e949e57b4": {
        x: -18.64913552756412,
        y: -126.48882515542682,
        id: "e69391bf-c9b2-4e84-9145-316e949e57b4",
      },
      "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8": {
        x: -17.445806767029865,
        y: -104.5217588994592,
        id: "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8",
      },
      "322ff86f-f9a2-4e0a-865f-cd37f550f128": {
        x: -39.41287302299748,
        y: -103.31843013892495,
        id: "322ff86f-f9a2-4e0a-865f-cd37f550f128",
      },
      "eb1c707a-87aa-48c4-b546-8dee67a2074b": {
        x: -38.20954426246323,
        y: -81.35136388295733,
        id: "eb1c707a-87aa-48c4-b546-8dee67a2074b",
      },
      "430abb17-1d02-4b71-8733-71d1faf430b8": {
        x: -16.242478006495613,
        y: -82.55469264349159,
        id: "430abb17-1d02-4b71-8733-71d1faf430b8",
      },
    },
    edges: {
      "f05847a8-e51b-4870-b8f0-04805f80b40a": {
        start: "ae05cb21-1dde-4644-9028-59eef1d0cb4d",
        end: "e69391bf-c9b2-4e84-9145-316e949e57b4",
        id: "f05847a8-e51b-4870-b8f0-04805f80b40a",
      },
      "9f5a4866-43d5-4d64-b373-7a7870038394": {
        start: "e69391bf-c9b2-4e84-9145-316e949e57b4",
        end: "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8",
        id: "9f5a4866-43d5-4d64-b373-7a7870038394",
      },
      "110ea953-6256-44b9-a11c-6a440e5d41b8": {
        start: "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8",
        end: "322ff86f-f9a2-4e0a-865f-cd37f550f128",
        id: "110ea953-6256-44b9-a11c-6a440e5d41b8",
      },
      "b8131894-847f-4b2a-8e40-a3fb3a414a65": {
        start: "322ff86f-f9a2-4e0a-865f-cd37f550f128",
        end: "eb1c707a-87aa-48c4-b546-8dee67a2074b",
        id: "b8131894-847f-4b2a-8e40-a3fb3a414a65",
      },
      "6ae07190-92b8-4929-b9b4-6ef36d83d218": {
        start: "eb1c707a-87aa-48c4-b546-8dee67a2074b",
        end: "430abb17-1d02-4b71-8733-71d1faf430b8",
        id: "6ae07190-92b8-4929-b9b4-6ef36d83d218",
      },
    },
  },
  sectionProps: {
    "e69391bf-c9b2-4e84-9145-316e949e57b4::0": {
      numberOfFloors: 4,
      startLeg: 0.9999999999999964,
      endLeg: 3.000000000000001,
      feature: CIRCULATION_FEATURE,
    },
    "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8::0": {
      numberOfFloors: 4,
      startLeg: 3,
      endLeg: 1,
      feature: CIRCULATION_FEATURE,
    },
    "322ff86f-f9a2-4e0a-865f-cd37f550f128::0": {
      numberOfFloors: 4,
      startLeg: 0.9999999999999964,
      endLeg: 3,
      feature: CIRCULATION_FEATURE,
    },
    "eb1c707a-87aa-48c4-b546-8dee67a2074b::0": {
      numberOfFloors: 4,
      startLeg: 3,
      endLeg: 1,
      feature: CIRCULATION_FEATURE,
    },
    "f05847a8-e51b-4870-b8f0-04805f80b40a::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 9,
      feature: CIRCULATION_FEATURE,
    },
    "9f5a4866-43d5-4d64-b373-7a7870038394::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 4,
      feature: CIRCULATION_FEATURE,
    },
    "110ea953-6256-44b9-a11c-6a440e5d41b8::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 8,
      feature: CIRCULATION_FEATURE,
    },
    "b8131894-847f-4b2a-8e40-a3fb3a414a65::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 4,
      feature: CIRCULATION_FEATURE,
    },
    "6ae07190-92b8-4929-b9b4-6ef36d83d218::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 15.000000000000002,
      feature: CIRCULATION_FEATURE,
    },
  },
  sections: {
    "f05847a8-e51b-4870-b8f0-04805f80b40a::0": {
      footPrint: [
        [-34.29700314266759, -119.622658896138],
        [-34.95336428477718, -131.60469503575672],
        [-25.96683718006316, -132.09696589233891],
        [-25.310476037953563, -120.1149297527202],
        [-34.29700314266759, -119.622658896138],
      ],
      length: 9,
      sectionType: "Rectangle",
    },
    "9f5a4866-43d5-4d64-b373-7a7870038394::0": {
      footPrint: [
        [-24.147882740791275, -117.174117479658],
        [-12.165846601172575, -117.8304786217676],
        [-11.94705955380271, -113.83646657522803],
        [-23.92909569342141, -113.18010543311843],
        [-24.147882740791275, -117.174117479658],
      ],
      length: 4,
      sectionType: "Rectangle",
    },
    "110ea953-6256-44b9-a11c-6a440e5d41b8::0": {
      footPrint: [
        [-24.763508419528904, -110.12989963637128],
        [-24.107147277419315, -98.14786349675259],
        [-32.09517137049845, -97.71028940201288],
        [-32.75153251260804, -109.69232554163156],
        [-24.763508419528904, -110.12989963637128],
      ],
      length: 8,
      sectionType: "Rectangle",
    },
    "b8131894-847f-4b2a-8e40-a3fb3a414a65::0": {
      footPrint: [
        [-44.911620236224636, -94.00372246315612],
        [-32.929584096605936, -94.66008360526573],
        [-32.71079704923608, -90.66607155872616],
        [-44.69283318885478, -90.00971041661656],
        [-44.911620236224636, -94.00372246315612],
      ],
      length: 4,
      sectionType: "Rectangle",
    },
    "6ae07190-92b8-4929-b9b4-6ef36d83d218::0": {
      footPrint: [
        [-30.89184260996419, -75.74322314604524],
        [-31.548203752073785, -87.72525928566395],
        [-16.57065857755041, -88.54571071330093],
        [-15.914297435440815, -76.56367457368225],
        [-30.89184260996419, -75.74322314604524],
      ],
      length: 14.999999999999998,
      sectionType: "Rectangle",
    },
    "e69391bf-c9b2-4e84-9145-316e949e57b4::0": {
      footPrint: [
        [-25.96683718006316, -132.09696589233891],
        [-12.986298028809566, -132.80802379629097],
        [-12.165846601172573, -117.83047862176758],
        [-24.147882740791275, -117.174117479658],
        [-24.31197302631867, -120.16962651456267],
        [-25.31047603795356, -120.1149297527202],
        [-25.96683718006316, -132.09696589233891],
      ],
      startLeg: 0.9999999999999964,
      endLeg: 3.000000000000001,
      angle: 1.570796326794897,
      sectionType: "Corner",
    },
    "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8::0": {
      footPrint: [
        [-11.94705955380271, -113.83646657522803],
        [-11.126608126165717, -98.85892140070465],
        [-24.107147277419315, -98.14786349675259],
        [-24.763508419528904, -110.12989963637129],
        [-23.765005407894012, -110.18459639821376],
        [-23.92909569342141, -113.18010543311843],
        [-11.94705955380271, -113.83646657522803],
      ],
      startLeg: 3,
      endLeg: 1,
      angle: 1.570796326794897,
      sectionType: "Corner",
    },
    "322ff86f-f9a2-4e0a-865f-cd37f550f128::0": {
      footPrint: [
        [-32.75153251260804, -109.69232554163156],
        [-32.09517137049845, -97.71028940201288],
        [-33.09367438213334, -97.65559264017041],
        [-32.929584096605936, -94.66008360526574],
        [-44.911620236224636, -94.00372246315615],
        [-45.732071663861625, -108.98126763767952],
        [-32.75153251260804, -109.69232554163156],
      ],
      startLeg: 0.9999999999999964,
      endLeg: 3,
      angle: -1.5707963267948966,
      sectionType: "Corner",
    },
    "eb1c707a-87aa-48c4-b546-8dee67a2074b::0": {
      footPrint: [
        [-44.69283318885478, -90.00971041661656],
        [-32.71079704923608, -90.66607155872616],
        [-32.54670676370868, -87.67056252382149],
        [-31.548203752073785, -87.72525928566395],
        [-30.891842609964186, -75.74322314604525],
        [-43.87238176121779, -75.03216524209319],
        [-44.69283318885478, -90.00971041661656],
      ],
      startLeg: 3,
      endLeg: 1,
      angle: -1.5707963267948974,
      sectionType: "Corner",
    },
  },
  feature: CIRCULATION_FEATURE,
}

const SECTION_SELECTION: SectionSelection = {
  fullSelection: true,
  allSectionIds: [
    "f05847a8-e51b-4870-b8f0-04805f80b40a::0",
    "9f5a4866-43d5-4d64-b373-7a7870038394::0",
    "110ea953-6256-44b9-a11c-6a440e5d41b8::0",
    "b8131894-847f-4b2a-8e40-a3fb3a414a65::0",
    "6ae07190-92b8-4929-b9b4-6ef36d83d218::0",
    "e69391bf-c9b2-4e84-9145-316e949e57b4::0",
    "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8::0",
    "322ff86f-f9a2-4e0a-865f-cd37f550f128::0",
    "eb1c707a-87aa-48c4-b546-8dee67a2074b::0",
  ],
  activeSectionIds: [
    "f05847a8-e51b-4870-b8f0-04805f80b40a::0",
    "9f5a4866-43d5-4d64-b373-7a7870038394::0",
    "110ea953-6256-44b9-a11c-6a440e5d41b8::0",
    "b8131894-847f-4b2a-8e40-a3fb3a414a65::0",
    "6ae07190-92b8-4929-b9b4-6ef36d83d218::0",
    "e69391bf-c9b2-4e84-9145-316e949e57b4::0",
    "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8::0",
    "322ff86f-f9a2-4e0a-865f-cd37f550f128::0",
    "eb1c707a-87aa-48c4-b546-8dee67a2074b::0",
  ],
  unSectioned: false,
  selectedSectionIds: undefined,
}

const BAKED_LINE_BUILDING_PARAMETERS: LineBuildingParameters = {
  ...LINE_BUILDING_PARAMETERS,
  lineAlignment: "center",
  customLayouts: [
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 9, y: 0 },
              { x: 9, y: 12 },
              { x: 0, y: 12 },
              { x: 0, y: 0 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            "77a2d1a365e23": {
              polygon: [
                { x: 0, y: 12 },
                { x: 0, y: 2 },
                { x: 9, y: 2 },
                { x: 9, y: 12 },
                { x: 0, y: 12 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "77a2d1a365e23",
            },
            af358cd6c475d: {
              polygon: [
                { x: 0, y: 2 },
                { x: 0, y: 0 },
                { x: 9, y: 0 },
                { x: 9, y: 2 },
                { x: 0, y: 2 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "af358cd6c475d",
            },
          },
        },
      ],
      id: "dba84e067efe2",
      sectionType: "Rectangle",
      name: "Circulation",
      revision: "1712919208588",
      length: 9,
      width: 12,
    },
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 12 },
              { x: 0, y: 12 },
              { x: 0, y: 0 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            "2bf21ebedfcc2": {
              polygon: [
                { x: 0, y: 12 },
                { x: 0, y: 2 },
                { x: 4, y: 2 },
                { x: 4, y: 12 },
                { x: 0, y: 12 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "2bf21ebedfcc2",
            },
            "3fd0959f157a": {
              polygon: [
                { x: 0, y: 2 },
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 2 },
                { x: 0, y: 2 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "3fd0959f157a",
            },
          },
        },
      ],
      id: "b6ba8745300cf",
      sectionType: "Rectangle",
      name: "Circulation",
      revision: "1712919208588",
      length: 4,
      width: 12,
    },
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 8, y: 12 },
              { x: 0, y: 12 },
              { x: 0, y: 0 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            "357ead7829f67": {
              polygon: [
                { x: 0, y: 12 },
                { x: 0, y: 2 },
                { x: 8, y: 2 },
                { x: 8, y: 12 },
                { x: 0, y: 12 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "357ead7829f67",
            },
            c2f7e7cb9ee1d: {
              polygon: [
                { x: 0, y: 2 },
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 2 },
                { x: 0, y: 2 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "c2f7e7cb9ee1d",
            },
          },
        },
      ],
      id: "e79cd2c7527",
      sectionType: "Rectangle",
      name: "Circulation",
      revision: "1712919208588",
      length: 8,
      width: 12,
    },
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 15, y: 0 },
              { x: 15, y: 12 },
              { x: 0, y: 12 },
              { x: 0, y: 0 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            abe3151d10653: {
              polygon: [
                { x: 0, y: 12 },
                { x: 0, y: 2 },
                { x: 15, y: 2 },
                { x: 15, y: 12 },
                { x: 0, y: 12 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "abe3151d10653",
            },
            "5f6dfa262437d": {
              polygon: [
                { x: 0, y: 2 },
                { x: 0, y: 0 },
                { x: 15, y: 0 },
                { x: 15, y: 2 },
                { x: 0, y: 2 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "5f6dfa262437d",
            },
          },
        },
      ],
      id: "2dee19b2c119b",
      sectionType: "Rectangle",
      name: "Circulation",
      revision: "1712919208588",
      length: 15,
      width: 12,
    },
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 15.000000038461243, y: 0 },
              { x: 14.999999996794898, y: 13.000000038461243 },
              { x: 2.999999996794898, y: 13 },
              { x: 3.0000000000000018, y: 12 },
              { x: 1.7763568394002505e-15, y: 12 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            d0ebb944d0c73: {
              polygon: [
                { x: 0, y: 2 },
                { x: 13.000000032051037, y: 2 },
                { x: 12.9999999967949, y: 13.000000032051037 },
                { x: 2.9999999967948967, y: 13 },
                { x: 3, y: 12 },
                { x: 0, y: 12 },
                { x: 0, y: 2 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "d0ebb944d0c73",
            },
            f04b161a9d90b: {
              polygon: [
                { x: 0, y: 0 },
                { x: 15.000000038461245, y: 0 },
                { x: 14.9999999967949, y: 13.000000038461245 },
                { x: 12.9999999967949, y: 13.000000032051037 },
                { x: 13.000000032051037, y: 2 },
                { x: 0, y: 2 },
                { x: 0, y: 0 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "f04b161a9d90b",
            },
          },
        },
      ],
      id: "78757ab1ab8b",
      sectionType: "Corner",
      name: "Circulation",
      revision: "1712919208588",
      width: 12,
      startLeg: 3,
      endLeg: 1,
      angle: 1.57079633,
    },
    {
      floors: [
        {
          outerShape: {
            polygon: [
              { x: 0, y: 0 },
              { x: 15.000000038461243, y: 0 },
              { x: 14.999999996794898, y: 13.000000038461243 },
              { x: 2.999999996794898, y: 13 },
              { x: 3.0000000000000018, y: 12 },
              { x: 1.7763568394002505e-15, y: 12 },
            ],
            holes: [],
          },
          name: "middleFloor",
          units: {
            dd2020aa3c1: {
              polygon: [
                { x: 0, y: 10 },
                { x: 5.0000000064102075, y: 10 },
                { x: 4.999999996794897, y: 13.000000006410207 },
                { x: 2.9999999967948967, y: 13 },
                { x: 3, y: 12 },
                { x: 0, y: 12 },
                { x: 0, y: 10 },
              ],
              holes: [],
              type: "CORRIDOR",
              id: "dd2020aa3c1",
            },
            e675608640d: {
              polygon: [
                { x: 0, y: 0 },
                { x: 15.000000038461245, y: 0 },
                { x: 14.9999999967949, y: 13.000000038461245 },
                { x: 4.999999996794897, y: 13.000000006410207 },
                { x: 5.0000000064102075, y: 10 },
                { x: 0, y: 10 },
                { x: 0, y: 0 },
              ],
              holes: [],
              type: "LIVING_UNIT",
              id: "e675608640d",
            },
          },
        },
      ],
      id: "05723e7c4ec78",
      sectionType: "Corner",
      name: "Circulation",
      revision: "1712919208588",
      width: 12,
      startLeg: 3,
      endLeg: 1,
      angle: 1.57079633,
    },
  ],
  sectionProps: {
    "e69391bf-c9b2-4e84-9145-316e949e57b4::0": {
      numberOfFloors: 4,
      startLeg: 0.9999999999999964,
      endLeg: 3.000000000000001,
      feature: { name: "CustomLayout", customLayoutID: "78757ab1ab8b", settings: { flipX: false, flipY: false } },
    },
    "9d9c5caa-8cfb-4ef5-95a9-53e86c5479e8::0": {
      numberOfFloors: 4,
      startLeg: 3,
      endLeg: 1,
      feature: { name: "CustomLayout", customLayoutID: "78757ab1ab8b", settings: { flipX: false, flipY: false } },
    },
    "322ff86f-f9a2-4e0a-865f-cd37f550f128::0": {
      numberOfFloors: 4,
      startLeg: 0.9999999999999964,
      endLeg: 3,
      feature: { name: "CustomLayout", customLayoutID: "05723e7c4ec78", settings: { flipX: false, flipY: false } },
    },
    "eb1c707a-87aa-48c4-b546-8dee67a2074b::0": {
      numberOfFloors: 4,
      startLeg: 3,
      endLeg: 1,
      feature: { name: "CustomLayout", customLayoutID: "05723e7c4ec78", settings: { flipX: false, flipY: false } },
    },
    "f05847a8-e51b-4870-b8f0-04805f80b40a::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 9,
      feature: { name: "CustomLayout", customLayoutID: "dba84e067efe2", settings: { flipX: false, flipY: false } },
    },
    "9f5a4866-43d5-4d64-b373-7a7870038394::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 4,
      feature: { name: "CustomLayout", customLayoutID: "b6ba8745300cf", settings: { flipX: false, flipY: false } },
    },
    "110ea953-6256-44b9-a11c-6a440e5d41b8::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 8,
      feature: { name: "CustomLayout", customLayoutID: "e79cd2c7527", settings: { flipX: false, flipY: false } },
    },
    "b8131894-847f-4b2a-8e40-a3fb3a414a65::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 4,
      feature: { name: "CustomLayout", customLayoutID: "b6ba8745300cf", settings: { flipX: false, flipY: false } },
    },
    "6ae07190-92b8-4929-b9b4-6ef36d83d218::0": {
      numberOfFloors: 4,
      minSubBuildingLength: 15.000000000000002,
      feature: { name: "CustomLayout", customLayoutID: "2dee19b2c119b", settings: { flipX: false, flipY: false } },
    },
  },
}

function stripKeysFromObject(object: any, stripKeys: string[]) {
  return Object.fromEntries(Object.entries(object).filter(([k]) => !stripKeys.includes(k)))
}

describe("Line Building baking", () => {
  it("should correctly bake side corridors in corner sections", () => {
    const bakedParams = getBakedLineBuildingParameters(LINE_BUILDING_PARAMETERS, SECTION_SELECTION)
    expect(bakedParams).toBeDefined()

    Object.keys(LINE_BUILDING_PARAMETERS.sectionProps).forEach((section) => {
      // Verify the basic structure of the CustomLayout feature for this section
      const sectionFeature = bakedParams?.sectionProps[section].feature
      expect(sectionFeature?.name).toBe("CustomLayout")
      expect(sectionFeature?.settings).toEqual({ flipX: false, flipY: false })

      // Look up the customLayoutID and verify that it exists
      const customLayoutID = (sectionFeature as CustomFeature).customLayoutID
      const customLayout: CustomLayout = bakedParams?.customLayouts.find((layout) => layout.id == customLayoutID)
      expect(customLayout).toBeDefined()

      // Find the corresponding customLayout for the same section in the test fixture data and
      // extract the relevant parts of it that we want to match to the generated customLayout
      const fixtureSectionFeature = BAKED_LINE_BUILDING_PARAMETERS.sectionProps[section].feature
      const fixtureCustomLayoutID = (fixtureSectionFeature as CustomFeature).customLayoutID
      const fixtureCustomLayout: CustomLayout = BAKED_LINE_BUILDING_PARAMETERS.customLayouts.find(
        (layout) => layout.id == fixtureCustomLayoutID,
      )
      const fixtureFloor = fixtureCustomLayout.floors[0]
      const fixtureCorridorUnit: any = Object.values(fixtureFloor.units).find((unit: any) => unit.type == "CORRIDOR")
      const fixtureLivingUnit: any = Object.values(fixtureFloor.units).find((unit: any) => unit.type == "LIVING_UNIT")

      // Compare the basic structure of the customLayouts
      expect(customLayout).toMatchObject(stripKeysFromObject(fixtureCustomLayout, ["id", "revision", "floors"]))

      // Verify that there is exactly 1 floor and that its basic structure matches the fixture
      expect(customLayout.floors.length).toBe(1)
      const floor = customLayout.floors[0]
      expect(floor).toMatchObject(stripKeysFromObject(fixtureFloor, ["units"]))

      // Verify that there are exactly 2 units (CORRIDOR and LIVING_UNIT), and that they match the fixture
      expect(Object.entries(floor.units).length).toBe(2)
      const corridorUnit = Object.values(floor.units).find((unit: any) => unit.type == "CORRIDOR")
      const livingUnit = Object.values(floor.units).find((unit: any) => unit.type == "LIVING_UNIT")
      expect(corridorUnit).toMatchObject(stripKeysFromObject(fixtureCorridorUnit, ["id"]))
      expect(livingUnit).toMatchObject(stripKeysFromObject(fixtureLivingUnit, ["id"]))
    })
  })
})
