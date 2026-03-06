import type { Child, Urn } from "@spacemakerai/element-types"
import type { Action } from "src/core/legacy-actions"
import type { ElementClipboardValue } from "./types"
import { newChildKey, parseUrn } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import { getTranslator } from "src/i18n"
import type { InternalPath } from "src/lib/element/path"
import { mergePath } from "src/lib/element/path"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type { ActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { FormaElementBox } from "src/lib/element/statebox"
import type { KnownRepresentations } from "src/core/elements/ElementRepresentations"
import type { Proposal } from "src/core/elements/Proposal"

async function getDefaultDuplicationActions(
  proposal: Proposal,
  contextRoot: InternalPath,
  systemData: ElementClipboardValue[],
): Promise<Action[]> {
  const snapshot = proposal.snapshot

  const missingUrns = systemData.filter((child) => !snapshot.elements.has(child.urn)).map((child) => child.urn)

  const fetched = missingUrns.length > 0 ? await downloadAllElementData(new Set(missingUrns)) : undefined
  const fetchedElements: Map<Urn, FormaElementBox> = fetched?.elements ?? new Map([])

  function getElement(urn: Urn) {
    return fetchedElements.get(urn) ?? snapshot.getElementContainerOrThrow(urn).toFormaElementBox()
  }

  function getRepresentations(urn: Urn): KnownRepresentations {
    if (fetchedElements.has(urn) && fetched) {
      return {
        volumeMesh: fetched.representations.volumeMesh.get(urn),
        footprint: fetched.representations.footprint.get(urn),
        terrainShape: fetched.representations.terrainShape.get(urn),
        terrainTexture: fetched.representations.terrainTexture.get(urn),
        buildingFloors3DSketch_UNSTABLE: undefined,
      }
    }

    return {
      volumeMesh: snapshot.getElementContainerOrThrow(urn).representations.volumeMesh,
      footprint: snapshot.getElementContainerOrThrow(urn).representations.footprint,
      terrainShape: snapshot.getElementContainerOrThrow(urn).representations.terrainShape,
      terrainTexture: snapshot.getElementContainerOrThrow(urn).representations.terrainTexture,
      buildingFloors3DSketch_UNSTABLE: undefined,
    }
  }

  let actions: Action<"add">[] = []
  for (let child of systemData) {
    addActionRecursive({ ...child, key: newChildKey() }, getElement, getRepresentations, contextRoot, actions)
  }

  // Track building duplication events
  for (const child of systemData) {
    const element = getElement(child.urn).element
    if (BasicBuildingAPI.isBasicBuilding(element)) {
      dispatchBuildingEvent("basic_building", EventName.Add, "copy")
    } else if (lineBuildingApi.isLineBuildingFormaElement(element)) {
      dispatchBuildingEvent("line_building", EventName.Add, "copy")
    } else if (isParcelComposition(element)) {
      // Single row house: Detected using isParcelComposition() for individual row house elements
      dispatchBuildingEvent("row_house", EventName.Add, "copy", { sub_feature: "single_row_house" })
    } else if (element.properties?.generator?.generatorId === "composition-graph-v0") {
      // Row house line: Detected by generatorId "composition-graph-v0" (only used for row houses)
      dispatchBuildingEvent("row_house", EventName.Add, "copy", { sub_feature: "row_house_line", shape_type: "line" })
    }
  }

  return actions
}

function groupBySystem(data: ElementClipboardValue[]) {
  return data.reduce(
    (acc, child) => {
      const parsed = parseUrn(child.urn)
      if (!acc[parsed.system]) {
        acc[parsed.system] = []
      }
      acc[parsed.system].push(child)
      return acc
    },
    {} as Record<string, ElementClipboardValue[]>,
  )
}

export function getDuplicateActions(
  data: ElementClipboardValue[],
  actionApi: ActionAPI,
  proposal: Proposal,
  contextRoot: InternalPath,
): Promise<Action[]> {
  if (
    data.some(({ urn }) => {
      const parsed = parseUrn(urn)
      return parsed.authcontext !== PROJECT_ID
    })
  ) {
    const t = getTranslator()
    window.forma_toasts.push({ status: "warning", content: t(($) => $.copyPaste.cannotCopyAcrossAuthContextsMessage) })
    return Promise.resolve([])
  }

  const groupedData = groupBySystem(data)

  return Promise.all(
    Object.entries(groupedData).map(async ([system, systemData]): Promise<Action[]> => {
      switch (system) {
        case "basic":
          return BasicElementAPI.basicActionsToCoreActions(await BasicElementAPI.duplicate(systemData))
        case "floor-stack-2": {
          // omit pasting floorstacks, use basic buildings in stead
          return []
        }
        case "proposal": {
          console.warn("Deprecated pasting pointers")
          const t = getTranslator()
          window.forma_toasts.push({ status: "warning", content: t(($) => $.copyPaste.failedToCopyElementMessage) })
          return Promise.resolve([])
        }
        case "basicbuilding": {
          return BasicBuildingAPI.actions.duplicate(systemData, proposal.snapshot.getFormaElementLookup(), actionApi)
        }
        default: {
          return getDefaultDuplicationActions(proposal, contextRoot, systemData)
        }
      }
    }),
  ).then((res) => res.flat())
}

function addActionRecursive(
  child: Child,
  getElement: (urn: Urn) => FormaElementBox,
  getRepresentations: (urn: Urn) => KnownRepresentations,
  parentPath: InternalPath,
  target: Action<"add">[],
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { urn: _, ...withoutUrn } = child

  const childElementBox = getElement(child.urn)

  target.push({
    type: "add",
    parentPath: parentPath,
    child: { ...withoutUrn },
    element: childElementBox.element,
    representations: getRepresentations(child.urn),
    persisted: childElementBox.isServerState,
  })

  for (let _child of childElementBox.element.children ?? []) {
    addActionRecursive(_child, getElement, getRepresentations, mergePath(parentPath, child.key), target)
  }
}
