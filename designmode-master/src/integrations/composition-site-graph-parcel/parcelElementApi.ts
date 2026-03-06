import type { FormaElement, Child } from "@spacemakerai/element-types"
import { createUrn, newChildKey, newId, newRevision, replaceRevision } from "src/lib/element/urn"
import { Matrix4 } from "three"

import type { ParcelTemplate } from "./templates/types"
import privateOutdoorSpaceGenerator from "./privateOutdoorSpace/privateOutdoorSpaceGenerator"
import type {
  RowhouseElement,
  RowHouseParameters,
  RowhouseUrn,
} from "src/integrations/composition-row-house-generator/api"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { mapOfFormaElements } from "src/lib/element/utils"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import {
  knownRepresentationsToRepresentationsByUrn,
  representationsByUrnToKnownRepresentations,
} from "src/core/elements/ElementRepresentations"
import { PROJECT_ID } from "src/core/project/project"

export const defaultParcelParameters: ParcelParameters = {
  width: 6,
  depth: 16,
  buildingPositionParameters: {
    x: { type: "center" },
    y: { type: "center" },
  },
}
export const createParcelElementWithRowHouse = (
  parcelParameters: ParcelParameters,
  rowHouseParameters: RowHouseParameters,
) => {
  // TODO: Merge this method with updateTemplate below, to make sure all the logic stays in sync

  const { geometry, element: rowHouseElement } = rowHouseApi.generateRowHouse(rowHouseParameters, PROJECT_ID)

  const buildingPositionTransform = calculateBuildingTransform({
    parcelWidth: parcelParameters.width,
    parcelDepth: parcelParameters.depth,
    buildingDepth: rowHouseParameters.buildingDepth,
    buildingWidth: rowHouseParameters.buildingWidth,
    buildingPositionParameters: parcelParameters.buildingPositionParameters,
  })

  const rowhouseChild: Child = {
    key: newChildKey(),
    urn: rowHouseElement.urn,
    transform: buildingPositionTransform.toArray(),
  }
  const _parcelElement = createParcelElement([rowhouseChild], parcelParameters)

  const { element: privateOutdoorSpaceElement, terrainShape } = privateOutdoorSpaceGenerator.generate({
    width: parcelParameters.width,
    depth: parcelParameters.depth,
  })

  const parcelElement = {
    ..._parcelElement,
    children: _parcelElement.children?.concat([{ key: newChildKey(), urn: privateOutdoorSpaceElement.urn }]),
  }
  const elements = mapOfFormaElements(parcelElement, rowHouseElement, privateOutdoorSpaceElement)

  return {
    rootUrn: parcelElement.urn,
    elements,
    rowHouseElement,
    representations: {
      footprint: new Map(),
      volumeMesh: new Map([[rowHouseElement.urn, geometry]]),
      terrainShape: new Map([[privateOutdoorSpaceElement.urn, terrainShape]]),
      terrainTexture: new Map(),
      buildingFloors3DSketch_UNSTABLE: new Map(),
    } satisfies RepresentationsByUrn,
    parcelElement,
    privateOutdoorSpaceElement,
  }
}

const PARCEL_ELEMENT_GENERATOR_ID = "parcel-composition-v0.1"

//Uses params from parent to generate elements as children.
type DerivedGenerator = {
  generatorId: string
}
export type ParcelParameters = {
  width: number
  depth: number
  buildingPositionParameters: PositionParameters
}
export type PositionParameters = {
  x:
    | {
        type: "start" | "end"
        buffer: number
      }
    | {
        type: "center"
      }
  y:
    | {
        type: "start" | "end"
        buffer: number
      }
    | {
        type: "center"
      }
}
export type ParcelCompositionElement = {
  properties: {
    generator: {
      generatorId: string
      parameters: ParcelParameters
      derivingElementGenerators: DerivedGenerator[]
    }
    category: string
  }
} & FormaElement

export const isParcelComposition = (element?: FormaElement): element is ParcelCompositionElement => {
  return element?.properties?.generator?.generatorId === PARCEL_ELEMENT_GENERATOR_ID
}

export function createParcelElement(children: Child[], parcelParameters: ParcelParameters): ParcelCompositionElement {
  return {
    urn: createUrn("parametric", PROJECT_ID, newId(), newRevision()),
    properties: {
      category: "parcel",
      generator: {
        derivingElementGenerators: [{ generatorId: privateOutdoorSpaceGenerator.generatorId }],
        generatorId: PARCEL_ELEMENT_GENERATOR_ID,
        parameters: parcelParameters,
      },
    },
    children,
  }
}

export function calculateBuildingTransform({
  parcelWidth,
  parcelDepth,
  buildingWidth,
  buildingDepth,
  buildingPositionParameters,
}: {
  parcelWidth: number
  parcelDepth: number
  buildingWidth: number
  buildingDepth: number
  buildingPositionParameters: PositionParameters
}) {
  let offSetPosY: number
  switch (buildingPositionParameters.y.type) {
    case "center":
      offSetPosY = 0
      break
    case "start":
      offSetPosY = (parcelDepth - buildingDepth) / 2 - buildingPositionParameters.y.buffer
      break
    case "end":
      offSetPosY = -(parcelDepth - buildingDepth) / 2 + buildingPositionParameters.y.buffer
      break
  }
  let offSetPosX: number
  switch (buildingPositionParameters.x.type) {
    case "center":
      offSetPosX = 0
      break
    case "start":
      offSetPosX = -(parcelWidth - buildingWidth) / 2 + buildingPositionParameters.x.buffer
      break
    case "end":
      offSetPosX = (parcelWidth - buildingWidth) / 2 - buildingPositionParameters.x.buffer
      break
  }
  return new Matrix4().makeTranslation(offSetPosX, offSetPosY, 0)
}

export function updateTemplate(
  previousParcelTemplate: ParcelTemplate,
  parcelParameters: ParcelParameters,
  rowHouseParameters: RowHouseParameters,
): ParcelTemplate {
  const { element: updatedRowHouseElement, geometry } = rowHouseApi.generateRowHouse(rowHouseParameters, PROJECT_ID)
  //We need to use the same urn and bump revision on update.
  const rowHouseElement: RowhouseElement = {
    ...updatedRowHouseElement,
    urn: replaceRevision(previousParcelTemplate.rowHouseElement.urn) as RowhouseUrn,
  }
  //hard coded for now
  const {
    width: parcelWidth,
    depth: parcelDepth,
    buildingPositionParameters: buildingPositionParameters,
  } = parcelParameters
  const { terrainShape, element: privateOutdoorSpaceElement } = privateOutdoorSpaceGenerator.generate({
    width: parcelWidth,
    depth: parcelDepth,
  })
  const { buildingDepth, buildingWidth } = rowHouseParameters

  const buildingPositionTransform = calculateBuildingTransform({
    parcelWidth,
    parcelDepth,
    buildingDepth,
    buildingWidth,
    buildingPositionParameters,
  })
  return {
    id: previousParcelTemplate.id,
    name: rowHouseParameters.typeName,
    representations: {
      volumeMesh: new Map([[rowHouseElement.urn, geometry]]),
      terrainShape: new Map([[privateOutdoorSpaceElement.urn, terrainShape]]),
      footprint: new Map(),
      terrainTexture: new Map(),
      buildingFloors3DSketch_UNSTABLE: new Map(),
    },
    element: {
      ...previousParcelTemplate.element,
      urn: replaceRevision(previousParcelTemplate.element.urn),
      //TODO find a way to keep this stable
      children: [
        { urn: rowHouseElement.urn, key: newChildKey(), transform: buildingPositionTransform.toArray() },
        { urn: privateOutdoorSpaceElement.urn, key: newChildKey() },
      ],
      properties: {
        ...previousParcelTemplate.element.properties,
        generator: {
          ...previousParcelTemplate.element.properties.generator,
          parameters: {
            width: parcelWidth,
            depth: parcelDepth,
            buildingPositionParameters: buildingPositionParameters,
          },
        },
      },
    },
    privateOutdoorSpaceElement,
    rowHouseElement,
  }
}

export const setNameOnTemplateAndElements = (template: ParcelTemplate, name: string): ParcelTemplate => {
  const rowHouseElement = rowHouseApi.setRowHouseType(template.rowHouseElement, name)
  return {
    ...template,
    // Pass data forward under new URN.
    representations: knownRepresentationsToRepresentationsByUrn(
      representationsByUrnToKnownRepresentations(template.representations, template.rowHouseElement.urn),
      rowHouseElement.urn,
    ),
    name: name,
    element: {
      ...template.element,
      children: [
        { urn: rowHouseElement.urn, key: newChildKey() },
        {
          urn: template.privateOutdoorSpaceElement.urn,
          key: newChildKey(),
        },
      ],
      urn: replaceRevision(template.element.urn),
    },
    rowHouseElement,
  }
}
export const toElements = (template: ParcelTemplate) => {
  const elements = mapOfFormaElements(template.element, template.rowHouseElement, template.privateOutdoorSpaceElement)
  const rootUrn = template.element.urn
  return {
    elements,
    rootUrn,
  }
}
