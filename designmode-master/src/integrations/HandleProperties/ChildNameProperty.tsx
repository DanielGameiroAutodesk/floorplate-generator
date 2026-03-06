import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import { useCallback, useMemo } from "preact/compat"
import type { FormaElement } from "@spacemakerai/element-types"
import TextInput from "src/integrations/inputs/TextInput"
import { getLeafKey, getParentPath } from "src/lib/element/path"
import { replaceRevision } from "src/lib/element/urn"
import { elementState } from "src/core/elements/ElementState"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { useTranslator } from "src/i18n"

export default function ChildNameProperty({ selected }: { selected: BasicFeaturePathInfo[] }) {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value

  const { parentPath, childKey, parentElement } = useMemo(() => {
    if (selected.length !== 1) return {}

    const selectedPath = selected[0].path

    const parentPath = getParentPath(selectedPath)!
    const childKey = getLeafKey(selectedPath)

    const parentElement = snapshot.getNodeOrThrow(parentPath).elementContainer.element

    return {
      parentElement,
      parentPath,
      childKey,
    }
  }, [selected, snapshot])

  const initialValue = useMemo(() => {
    return parentElement?.children?.find((c) => c.key === childKey)?.name || ""
  }, [childKey, parentElement?.children])

  const onBlur = useCallback(
    (newName: string): void => {
      if (!childKey || !parentPath) return
      return onBlurNewElementState(newName, childKey, parentPath)
    },
    [childKey, parentPath],
  )

  const placeHolder = useMemo(() => {
    if (!parentElement) return
    const child = parentElement.children?.find((c) => c.key === childKey)
    if (!child) return
    const element = snapshot.getElementContainerOrThrow(child.urn).element
    return generateChildName(child, element)
  }, [childKey, parentElement, snapshot])

  return (
    <div style={{ height: "36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ font: "var(--12-medium)" }}>{t(($) => $.properties.name)}</div>
      <TextInput
        disabled={selected.length > 1}
        initialValue={selected.length > 1 ? "..." : initialValue}
        placeholder={placeHolder}
        onBlur={onBlur}
      />
    </div>
  )
}

export function generateChildName(child: { urn: string }, element: FormaElement) {
  const categoryText =
    (element.properties &&
      element.properties.category &&
      {
        zone: "Zone",
        site_limit: "Site limit",
      }[element.properties.category]) ??
    "Object"
  const [, , , , elementId] = child.urn.split(":")
  return `${categoryText} ${elementId.slice(-3)}`
}

function onBlurNewElementState(newName: string, childKey: string, parentPath: string) {
  const proposal = elementState.currentProposalSignal.peek()

  if (proposal.path.value === parentPath) {
    const prevProposal = proposal.container.element
    const newProposalElement = {
      ...prevProposal,
      urn: replaceRevision(prevProposal.urn),
      children: prevProposal.children?.map((child) => (child.key === childKey ? { ...child, name: newName } : child)),
    }
    elementState.updateProposal(ElementContainer.fromDraftElement(newProposalElement, proposal.container.children))
  } else if (proposal.base.path.value === parentPath) {
    const prevBase = proposal.base.container.element
    const newBase = {
      ...prevBase,
      urn: replaceRevision(prevBase.urn),
      children: prevBase.children?.map((child) => (child.key === childKey ? { ...child, name: newName } : child)),
    }
    elementState.updateBase(ElementContainer.fromDraftElement(newBase, proposal.base.container.children))
  } else {
    console.warn("Cannot edit child name on element which is not proposal or base")
  }
}
