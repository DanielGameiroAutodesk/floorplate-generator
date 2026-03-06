import { HiddenPaths } from "src/core/hidden"
import { useEffect, useState } from "preact/hooks"
import styles from "./HUD.module.pcss"
import LabelWrapper from "src/integrations/labels/Label/LabelWrapper"
import { ANNOTATION_LABEL_CATEGORY } from "src/integrations/labels/constants"
import { Matrix4 } from "three"
import type { Transform } from "@spacemakerai/element-types"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { selectionArraySignal } from "src/core/selection/selectionState"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { DesignModeEvents } from "src/core/events/events"
import { TransportationRadiusControl } from "src/integrations/transportation/tools/RadiusControl"

export default function HUD({ scale }: { scale?: number }) {
  const annotationLabelsSignal = useComputed(() => {
    if (!isAppInitializedSignal.value) return []

    const hiddenPaths = HiddenPaths.allHiddenPathsExpandedSignal.value

    return elementState.currentProposalSignal.value
      .getToplevelNodes()
      .filter(
        (node) => node.elementContainer.mappedCategory === ANNOTATION_LABEL_CATEGORY && !node.getIsHiddenReactive(),
      )
      .filter((node) => !hiddenPaths.has(node.path))
  })

  return (
    <div id="hud" className={styles.Hud}>
      {annotationLabelsSignal.value.map((node) => (
        <LabelWrapper
          worldTransform={node.globalMatrix}
          key={`${node.elementContainer.element.urn}_${node.path}`}
          path={node.path}
          isInBase={node.isInBase}
          scale={scale}
        />
      ))}
      {isAppInitializedSignal.value && <AffinePreviewHUD />}
      <TransportationRadiusControl />
    </div>
  )
}

function AffinePreviewHUD() {
  // assume selected & hidden means we want to show a preview
  const affinePreviewLabels = useComputed(() => {
    return selectionArraySignal.value.flatMap((path) => {
      if (!HiddenPaths.allHiddenPathsExpandedSignal.value.has(path)) return []

      const node = elementState.currentSnapshot.value.getNode(path)
      if (!node) return []

      if (node.elementContainer.mappedCategory !== ANNOTATION_LABEL_CATEGORY) return []

      return [node]
    })
  }).value

  const [previewTransform, setPreviewTransform] = useState<Matrix4 | undefined>(undefined)

  useEffect(() => {
    const handlePreview = (e: CustomEvent<Transform | undefined>) => {
      if (e.detail === undefined) {
        setPreviewTransform(undefined)
        return
      }
      setPreviewTransform(new Matrix4().fromArray(e.detail))
    }

    function handleEditEnd() {
      setPreviewTransform(undefined)
    }

    DesignModeEvents.addListener("tool.edit.end", handleEditEnd)
    DesignModeEvents.addListener("tool.affine.preview", handlePreview)

    return () => {
      DesignModeEvents.removeListener("tool.affine.preview", handlePreview)
      DesignModeEvents.removeListener("tool.edit.end", handleEditEnd)
    }
  }, [])

  return (
    <>
      {affinePreviewLabels.map((node) => {
        const previewWorldTransform = previewTransform?.clone().multiply(node.globalMatrix) ?? node.globalMatrix
        return (
          <LabelWrapper
            worldTransform={previewWorldTransform}
            key={node.path}
            path={node.path}
            isInBase={node.isInBase}
          />
        )
      })}
    </>
  )
}
