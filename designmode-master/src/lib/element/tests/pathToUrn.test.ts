import { describe, it, expect } from "vitest"
import { getPathToUrn } from "src/lib/element/path"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { recordToMap } from "src/lib/map"

describe("pathToUrn", () => {
  it("should work for very nested paths", () => {
    const elements = createElementBoxMapFromDraftElements(
      {
        urn: "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de:1703068392001",
        children: [
          {
            urn: "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de+988032b1-f6e6-41ad-a2ee-a5d052149aaa:1703068392001",
            key: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          },
        ],
        properties: {
          category: "building",
          hasClickableChildren: true,
          generator: {
            generatorId: "floorStack",
            parameters: {
              id: "97b4603c-59c5-483c-824f-65ebd7f054de",
              floors: [
                {
                  id: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
                  height: 5.041538947318031,
                  geometryIds: ["3d092697-2263-4333-b665-62da5cc5cd29"],
                  geometryId: "3d092697-2263-4333-b665-62da5cc5cd29",
                  horizontalCirculation: [],
                },
              ],
              geometries: {
                "3d092697-2263-4333-b665-62da5cc5cd29": {
                  polygon: [
                    [107.70131010674841, -181.3186811565978],
                    [104.15637295409778, -234.73248608218012],
                    [119.36180740952055, -235.74163174402392],
                    [125.23833718282513, -191.59079652390295],
                    [107.70131010674841, -181.3186811565978],
                  ],
                  holes: [],
                },
              },
            },
          },
        },
      },
      {
        urn: "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de+988032b1-f6e6-41ad-a2ee-a5d052149aaa:1703068392001",
        properties: {
          name: "floor 0",
          category: "floor",
          geometry: {
            glb: {
              id: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
              url: "/api/floor-stack-2/elements/1b4a20fe4349f/revisions/1703068392001?authcontext=pro_mosb5r8fmz&format=glb&version=2",
            },
            volumeMesh: {
              id: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
              url: "/api/floor-stack-2/elements/1b4a20fe4349f/revisions/1703068392001?authcontext=pro_mosb5r8fmz&format=glb&version=2",
            },
            volumes25D: {
              id: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
              url: "/api/floor-stack-2/elements/1b4a20fe4349f/revisions/1703068392001?authcontext=pro_mosb5r8fmz&format=geojson&version=2",
            },
            volume25DCollection: {
              id: "988032b1-f6e6-41ad-a2ee-a5d052149aaa",
              url: "/api/floor-stack-2/elements/1b4a20fe4349f/revisions/1703068392001?authcontext=pro_mosb5r8fmz&format=volume25DCollection&version=2",
            },
          },
          areaStatsReps: {
            grossFloorPolygons: [
              [
                [
                  [107.70131010674841, -181.3186811565978],
                  [104.15637295409778, -234.73248608218012],
                  [119.36180740952055, -235.74163174402392],
                  [125.23833718282513, -191.59079652390295],
                  [107.70131010674841, -181.3186811565978],
                ],
              ],
            ],
            grossFloorPolygonsV2: [
              {
                grossFloorPolygon: [
                  [
                    [107.70131010674841, -181.3186811565978],
                    [104.15637295409778, -234.73248608218012],
                    [119.36180740952055, -235.74163174402392],
                    [125.23833718282513, -191.59079652390295],
                    [107.70131010674841, -181.3186811565978],
                  ],
                ],
                elevation: 0,
                areaType: "UNASSIGNED",
              },
            ],
          },
        },
      },
      {
        urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:2dc5dcdde4865:1703068397627",
        children: [
          {
            key: "83e1484",
            urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
            transform: [
              0.7813333033279835, -0.624113987273624, 0, 0, 0.624113987273624, 0.7813333033279835, 0, 0, 0, 0, 1, 0,
              143.66822128377459, -45.87821667815953, 362.7415558849126, 1,
            ],
          },
          {
            key: "90095fc",
            urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
            transform: [
              0.7813333033279835, -0.624113987273624, 0, 0, 0.624113987273624, 0.7813333033279835, 0, 0, 0, 0, 1, 0,
              138.1988881604787, -41.50941876724417, 361.82363093586264, 1,
            ],
          },
        ],
        properties: {
          generator: {
            generatorId: "composition-graph-v0",
          },
          definingRepresentation: {
            graph: {
              id: "ec5b626e10028",
              vertices: {
                "7fd0b27f3d4a8": {
                  x: 129.03442145905916,
                  y: -44.42792759827432,
                },
                be795dc08c33c: {
                  x: 142.84686418881617,
                  y: -55.46104070037711,
                },
              },
              edges: {
                "0fcda9fcc3fb7": {
                  start: "7fd0b27f3d4a8",
                  end: "be795dc08c33c",
                },
              },
              _edges: {
                cff944fc9bd03: {
                  start: "7fd0b27f3d4a8",
                  end: "be795dc08c33c",
                  superEdgeId: "0fcda9fcc3fb7",
                },
              },
              _vertices: {
                "7fd0b27f3d4a8": {
                  x: 129.03442145905916,
                  y: -44.42792759827432,
                  type: "vertex",
                },
                be795dc08c33c: {
                  x: 142.84686418881617,
                  y: -55.46104070037711,
                  type: "vertex",
                },
              },
              _coEdges: {
                f5ec3a6bb16e8: {
                  edgeId: "cff944fc9bd03",
                  reverse: false,
                },
                fd42138eaee05: {
                  edgeId: "cff944fc9bd03",
                  reverse: true,
                  properties: {
                    parcelParameters: {
                      width: 7,
                      depth: 16,
                      orientation: 0,
                      relativeOrientation: true,
                      alignment: "center",
                      extraHouses: 0,
                      buffer: 0,
                      priority: 0,
                    },
                  },
                },
              },
              _loops: {
                ebde0bc6e04c9: {
                  coEdgeIds: ["f5ec3a6bb16e8", "fd42138eaee05"],
                },
              },
              _polygons: {},
              _counter: 3,
            },
            graphToChildrenConnection: {
              edges: {},
              coEdges: {
                fd42138eaee05: [
                  {
                    key: "83e1484",
                    urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
                    transform: [
                      0.7813333033279835, -0.624113987273624, 0, 0, 0.624113987273624, 0.7813333033279835, 0, 0, 0, 0,
                      1, 0, 143.66822128377459, -45.87821667815953, 362.7415558849126, 1,
                    ],
                  },
                  {
                    key: "90095fc",
                    urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
                    transform: [
                      0.7813333033279835, -0.624113987273624, 0, 0, 0.624113987273624, 0.7813333033279835, 0, 0, 0, 0,
                      1, 0, 138.1988881604787, -41.50941876724417, 361.82363093586264, 1,
                    ],
                  },
                ],
              },
            },
          },
          composingElement: true,
          category: "building",
        },
      },
      {
        urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
        children: [
          {
            urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:5d2a48a626315:1702916489989",
            key: "e8894de",
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          },
          {
            urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:eea3dbf840685:1702916489989",
            key: "47765f9",
          },
        ],
        properties: {
          category: "building",
          generator: {
            derivingElementGenerators: [
              {
                generatorId: "outdoor-area-generator",
              },
            ],
            generatorId: "parcel-composition-v0.1",
            parameters: {
              width: 7,
              depth: 16,
              buildingPositionParameters: {
                x: {
                  type: "center",
                },
                y: {
                  type: "center",
                },
              },
            },
          },
        },
      },
      {
        urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:5d2a48a626315:1702916489989",
        properties: {
          generator: {
            generatorId: "row-house-v0.2",
            parameters: {
              buildingWidth: 6,
              buildingDepth: 9,
              numberOfStories: 2,
              storyHeight: 3,
              floorThickness: 0.2,
              roofThickness: 0.1,
              roofShape: "gable",
              roofRidgeDirection: 0,
              parkingOnParcel: false,
              roofAngle: 15,
              outerWallThickness: 0.2,
              typeName: "Type A",
              functionId: "residential",
            },
          },
          category: "building",
          areaStatsReps: {
            grossFloorPolygonsV2: [
              {
                areaType: "LIVING_UNIT",
                grossFloorPolygon: [
                  [
                    [-3, -4.5],
                    [3, -4.5],
                    [3, 4.5],
                    [-3, 4.5],
                    [-3, -4.5],
                  ],
                ],
                elevation: 0,
              },
              {
                areaType: "LIVING_UNIT",
                grossFloorPolygon: [
                  [
                    [-3, -4.5],
                    [3, -4.5],
                    [3, 4.5],
                    [-3, 4.5],
                    [-3, -4.5],
                  ],
                ],
                elevation: 3,
              },
            ],
          },
          bb2d: [
            [-3, -4.5],
            [3, -4.5],
            [3, 4.5],
            [-3, 4.5],
            [-3, -4.5],
          ],
          rowHouseStats: {
            unitCount: 1,
            parkingSpots: 0,
            rowHouseType: "Type A",
          },
          functionId: "residential",
          geometry: {
            volumeMesh: {
              url: "/api/parametric/elements/5d2a48a626315/revisions/1702916489989?authcontext=pro_mosb5r8fmz&format=glb&version=1",
              id: "5d2a48a626315",
            },
          },
        },
      },
      {
        urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:eea3dbf840685:1702916489989",
        properties: {
          generator: {
            generatorId: "outdoor-area-generator",
            parameters: {
              width: 7,
              depth: 16,
            },
          },
          privateOutdoorSpace: {
            spaces: [
              {
                polygons: [
                  [
                    [-3.5, -8],
                    [3.5, -8],
                    [3.5, 8],
                    [-3.5, 8],
                  ],
                ],
              },
            ],
          },
          category: "privateOutdoorSpace",
        },
      },
      {
        urn: "urn:adsk-forma-elements:proposal:pro_mosb5r8fmz:1c6935d2-d82c-4c00-b715-b90ef76f801c:1703068397628",
        metadata: {
          predecessor:
            "urn:adsk-forma-elements:proposal:pro_mosb5r8fmz:1c6935d2-d82c-4c00-b715-b90ef76f801c:1703068394219",
          createdAt: "2023-12-20T10:33:19.220Z",
          createdBy: "Z9K2RXKJ4X4M",
        },
        properties: {
          name: "Proposal 9",
          category: "proposal",
        },
        children: [
          {
            key: "5b1c4eb",
            urn: "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:2dc5dcdde4865:1703068397627",
          },
          {
            key: "066597d",
            transform: [
              1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 25.229546922444996, 3.6716985907634125, 368.1965200936465, 1,
            ],
            urn: "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de:1703068392001",
          },
        ],
      },
    )
    const rootUrn = "urn:adsk-forma-elements:proposal:pro_mosb5r8fmz:1c6935d2-d82c-4c00-b715-b90ef76f801c:1703068397628"
    const correctResult = recordToMap({
      root: "urn:adsk-forma-elements:proposal:pro_mosb5r8fmz:1c6935d2-d82c-4c00-b715-b90ef76f801c:1703068397628",
      "root/5b1c4eb": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:2dc5dcdde4865:1703068397627",
      "root/5b1c4eb/83e1484": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
      "root/5b1c4eb/83e1484/e8894de": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:5d2a48a626315:1702916489989",
      "root/5b1c4eb/83e1484/47765f9": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:eea3dbf840685:1702916489989",
      "root/5b1c4eb/90095fc": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
      "root/5b1c4eb/90095fc/e8894de": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:5d2a48a626315:1702916489989",
      "root/5b1c4eb/90095fc/47765f9": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:eea3dbf840685:1702916489989",
      "root/066597d":
        "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de:1703068392001",
      "root/066597d/988032b1-f6e6-41ad-a2ee-a5d052149aaa":
        "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de+988032b1-f6e6-41ad-a2ee-a5d052149aaa:1703068392001",
    })
    /*const wrongResult = {
      root: "urn:adsk-forma-elements:proposal:pro_mosb5r8fmz:1c6935d2-d82c-4c00-b715-b90ef76f801c:1703068397628",
      "root/5b1c4eb": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:2dc5dcdde4865:1703068397627",
      "root/5b1c4eb/83e1484": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
      "root/923e816/47bb10d/e8894de": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:5d2a48a626315:1702916489989",
      "root/923e816/47bb10d/47765f9": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:eea3dbf840685:1702916489989",
      "root/5b1c4eb/90095fc": "urn:adsk-forma-elements:parametric:pro_mosb5r8fmz:198f01e0551d2:1702916489989",
      "root/066597d":
        "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de:1703068392001",
      "root/066597d/988032b1-f6e6-41ad-a2ee-a5d052149aaa":
        "urn:adsk-forma-elements:floor-stack-2:pro_mosb5r8fmz:1b4a20fe4349f+97b4603c-59c5-483c-824f-65ebd7f054de+988032b1-f6e6-41ad-a2ee-a5d052149aaa:1703068392001",
    }*/
    expect(getPathToUrn(bindFormaElementLookupForBoxMap(elements), rootUrn)).toEqual(correctResult)
  })
})
