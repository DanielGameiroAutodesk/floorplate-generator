import {
  ANNOTATION_LABEL_CATEGORY,
  ANNOTATION_LABEL_PROPERTY_NAME,
  type AnnotationLabelProperties,
  type AnnotationLabelStyles,
} from "src/integrations/labels/constants"
import type { FormaElement } from "forma-elements"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { replaceRevision } from "src/lib/element/urn"
import LabelPropertiesView from "./LabelPropertiesView"
import { useCallback, useMemo } from "preact/hooks"
import { useComputed } from "@preact/signals"
import { scenarioModeSignal, selectedNodesSignal } from "src/core/selection/selectionState"

export default function LabelProperties() {
  const selectedNodes = selectedNodesSignal.value

  const allSelectedElementsAreLabels = useMemo(
    () => selectedNodes.every((node) => node.element.properties?.category === ANNOTATION_LABEL_CATEGORY),
    [selectedNodes],
  )

  if (selectedNodes.length === 0 || !allSelectedElementsAreLabels) return null

  return <LabelPropertiesContainer />
}

function LabelPropertiesContainer() {
  const ActionAPI = useActionAPI()

  const selectedNodes = selectedNodesSignal.value

  const selectedMixed = useMemo(() => {
    const getMixedValue = (key: keyof AnnotationLabelProperties): boolean =>
      selectedNodes.some(
        (node) =>
          node.elementContainer.element.properties?.[ANNOTATION_LABEL_PROPERTY_NAME]?.[key] !==
          selectedNodes[0].elementContainer.element.properties?.[ANNOTATION_LABEL_PROPERTY_NAME]?.[key],
      )
    return {
      color: getMixedValue("color"),
      opacity: getMixedValue("opacity"),
      textAlign: getMixedValue("textAlign"),
    }
  }, [selectedNodes])

  const selectedValue = useMemo(() => {
    const getValue = (key: keyof AnnotationLabelProperties, mixed: boolean) =>
      mixed ? undefined : selectedNodes[0]?.elementContainer.element.properties?.[ANNOTATION_LABEL_PROPERTY_NAME]?.[key]

    return {
      color: getValue("color", selectedMixed.color),
      opacity: getValue("opacity", selectedMixed.opacity) * 100,
      textAlign: getValue("textAlign", selectedMixed.textAlign),
    }
  }, [selectedMixed, selectedNodes])

  const onChangeStyle = useCallback(
    (newStyleProperties: Partial<AnnotationLabelStyles>) => {
      const actions = selectedNodes.flatMap<Action>((node) => {
        const element = node.elementContainer.element
        if (element.properties?.category !== ANNOTATION_LABEL_CATEGORY) return []

        return ActionAPI.update.one(
          node.path,
          {
            ...element,
            urn: replaceRevision(element.urn),
            properties: {
              ...element?.properties,
              [ANNOTATION_LABEL_PROPERTY_NAME]: {
                ...element?.properties?.[ANNOTATION_LABEL_PROPERTY_NAME],
                ...newStyleProperties,
              },
            },
          } satisfies FormaElement,
          false,
        )
      })
      ActionAPI.apply(`Label: update styles`, actions)
    },
    [ActionAPI, selectedNodes],
  )

  // Disable editing properties if any proposal label selected in base editing context and vice versa
  const disableEditing = useComputed(() => {
    return selectedNodesSignal.value.some((node) => {
      const disableBaseEditing = node.isInBase && !scenarioModeSignal.value
      const disableProposalEditing = !node.isInBase && scenarioModeSignal.value
      return disableBaseEditing || disableProposalEditing
    })
  }).value

  return (
    <LabelPropertiesView
      value={selectedValue}
      mixed={selectedMixed}
      onChangeStyle={onChangeStyle}
      disabled={disableEditing}
    />
  )
}
