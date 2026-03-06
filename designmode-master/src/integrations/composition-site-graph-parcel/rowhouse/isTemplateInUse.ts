import { parseUrn } from "src/lib/element/urn"
import { isDefined, uniq } from "src/lib/array"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import type { RowhouseElement } from "src/integrations/composition-row-house-generator/api"

export type TemplateInUse =
  | { inUse: true; comparison: "TEMPLATE_IS_OLDER" | "TEMPLATE_IS_NEWER" | "EQUAL" | "MIXED" }
  | { inUse: false }

export function isTemplateUsedByParcelElement(
  template: ParcelTemplate,
  element: ParcelCompositionElement,
): TemplateInUse {
  const templateUrn = parseUrn(template.element.urn)
  const comparisonUrn = parseUrn(element.urn)
  if (templateUrn.id !== comparisonUrn.id) {
    return {
      inUse: false,
    }
  }
  if (templateUrn.revision === comparisonUrn.revision) {
    return {
      inUse: true,
      comparison: "EQUAL",
    }
  }
  return {
    inUse: true,
    comparison: templateUrn.revision > comparisonUrn.revision ? "TEMPLATE_IS_NEWER" : "TEMPLATE_IS_OLDER",
  }
}

/** @deprecated This shouldn't be needed now that we have isTemplateUsedByParcelElement..? */
export function isTemplateUsedByElement(template: ParcelTemplate, element: RowhouseElement): TemplateInUse {
  const templateUrn = parseUrn(template.rowHouseElement.urn)
  const comparisonUrn = parseUrn(element.urn)
  if (templateUrn.id !== comparisonUrn.id) {
    return {
      inUse: false,
    }
  }
  if (templateUrn.revision === comparisonUrn.revision) {
    return {
      inUse: true,
      comparison: "EQUAL",
    }
  }
  return {
    inUse: true,
    comparison: templateUrn.revision > comparisonUrn.revision ? "TEMPLATE_IS_NEWER" : "TEMPLATE_IS_OLDER",
  }
}

export function isTemplateInUseByElements(
  template: ParcelTemplate,
  selectedElements: ParcelCompositionElement[],
): TemplateInUse {
  const templateUrn = parseUrn(template.element.urn)

  const sameIdElements = selectedElements.filter((e) => {
    return parseUrn(e.urn).id === templateUrn.id
  })
  if (sameIdElements.length === 0) {
    return {
      inUse: false,
    } as const
  }
  const uniqueSelectedRevisions = uniq(sameIdElements.map((e) => parseUrn(e.urn).revision)).filter(isDefined)
  if (uniqueSelectedRevisions.length === 1) {
    const templateRevision = templateUrn.revision
    const comparison =
      templateRevision === uniqueSelectedRevisions[0]
        ? "EQUAL"
        : templateRevision > uniqueSelectedRevisions[0]
          ? "TEMPLATE_IS_NEWER"
          : "TEMPLATE_IS_OLDER"
    return {
      inUse: true,
      comparison,
    } as const
  }
  return {
    inUse: true,
    comparison: "MIXED",
  }
}
