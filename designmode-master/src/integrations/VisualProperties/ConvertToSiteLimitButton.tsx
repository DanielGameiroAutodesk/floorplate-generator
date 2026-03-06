import {
  selectedBasePathsInProposalContextSignal,
  selectedPathsInCurrentProposalAsArraySignal,
  selectedTopLevelNodesSignal,
} from "src/core/selection/selectionState"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import { isBasicElementUrn } from "src/lib/element/urn"
import { useTranslator } from "src/i18n"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback } from "preact/hooks"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { useComputed } from "@preact/signals"
import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"

const ConvertToSiteLimitButtonConditionallyRendered = () => {
  const t = useTranslator()
  const ActionsAPI = useActionAPI()
  const selection = selectedPathsInCurrentProposalAsArraySignal.value
  const convert = useCallback(() => {
    const actions = BasicElementAPI.basicActionsToCoreActions(
      selection.map((path) => {
        return BasicElementAPI.updateProperties(path, basicElementPresets.site_limit)
      }),
    )
    ActionsAPI.apply("Define as Site Limit", actions)
  }, [ActionsAPI, selection])

  return (
    <RightMenuPanel>
      <weave-button variant="flat" onClick={convert}>
        {t(($) => $.limits.siteLimit.defineAsAction)}
      </weave-button>
    </RightMenuPanel>
  )
}

function convertable(node: ChildNodeContainer) {
  const urn = node.elementContainer.element.urn
  if (!isBasicElementUrn(urn)) return false
  const category = node.elementContainer.element.properties?.category

  const categoryUnspecified =
    !category || [null, "generic", "zone", "unspecified", "property-boundaries", "property_boundary"].includes(category)

  const footprint = node.elementContainer.representations.footprint
  const volumeMesh = node.elementContainer.representations.volumeMesh

  const isPolygonGroundShape = !!footprint && footprint.geometry.type === "Polygon" && !volumeMesh

  return categoryUnspecified && isPolygonGroundShape
}

export const ConvertToSiteLimitButton = () => {
  const show = useComputed(() => {
    const selectedNodes = selectedTopLevelNodesSignal.value
    return selectedNodes.length && selectedNodes.every((node) => convertable(node))
  }).value

  if (!canEditProposalSignal.value) return null
  if (!show) return null
  if (selectedBasePathsInProposalContextSignal.value.size > 0) return null

  return <ConvertToSiteLimitButtonConditionallyRendered />
}
