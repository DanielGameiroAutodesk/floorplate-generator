import type { FormaElement } from "@spacemakerai/element-types"
import { useCallback } from "preact/hooks"
import { useEffect, useState } from "preact/compat"
import styles from "./ColorProperty.module.pcss"
import { scenarioModeSignal, selectedTopLevelNodesSignal } from "src/core/selection/selectionState"
import UnitInput from "src/integrations/inputs/UnitInput"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { isBasicElementUrn, isRasterElementUrn, replaceRevision } from "src/lib/element/urn"

import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"
import { useTranslator } from "src/i18n"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { rasterAPI } from "src/integrations/raster-element-system/api"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { useComputed } from "@preact/signals"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { is3dSketchElementGeneric, isImportElement } from "src/integrations/3dsketch/3dsketch-selection-state"
import { mergePath } from "src/lib/element/path"
import { isElement3dSketchBuilding } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"

function isGenericCategory(category: string | undefined) {
  return !category || category === "unspecified" || category === "generic"
}

function isReferenceImageCategory(category: string | undefined) {
  return category === "referenceImage"
}

function showColorPropertyForElement(elm: FormaElement): boolean {
  if (rasterAPI.isRasterElement(elm)) {
    return true
  }
  if (isBasicElementUrn(elm.urn)) {
    return isGenericCategory(elm.properties?.category) || isReferenceImageCategory(elm.properties?.category)
  }
  if (isElement3dSketchBuilding(elm)) {
    return false
  }
  if (is3dSketchElementGeneric(elm) || isImportElement(elm)) {
    return true
  }
  return false
}

function showOpacityPropertyForElement(node: ChildNodeContainer): boolean {
  const elm = node.elementContainer.element

  if (rasterAPI.isRasterElement(elm)) {
    return true
  }

  if (isBasicElementUrn(elm.urn)) {
    const volumeMesh = node.elementContainer.representations.volumeMesh
    const isVolume = !!volumeMesh
    if (isVolume) return false

    const footprint = node.elementContainer.representations.footprint
    const isPolygon = footprint?.geometry.type === "Polygon"
    if (!isPolygon) return false

    return isGenericCategory(elm.properties?.category) || isReferenceImageCategory(elm.properties?.category)
  }

  return false
}

export const ColorProperty = () => {
  const hasSelected = useComputed(() => selectedTopLevelNodesSignal.value.length > 0).value

  const allElementsCanBeColored = useComputed(() => {
    return selectedTopLevelNodesSignal.value.every((node) => showColorPropertyForElement(node.elementContainer.element))
  }).value

  const allElementsCanHaveOpacity = useComputed(() => {
    return selectedTopLevelNodesSignal.value.every((node) => showOpacityPropertyForElement(node))
  }).value

  if (!hasSelected || !allElementsCanBeColored) return null

  return <ColorPropertyRendered showOpacity={allElementsCanHaveOpacity} />
}

let debounceTimer: NodeJS.Timeout

const defaultColor = "#c4c4c4"
const defaultOpacity = 1

const ColorPropertyRendered = ({ showOpacity }: { showOpacity: boolean }) => {
  const selected = selectedTopLevelNodesSignal.value

  const ActionsAPI = useActionAPI()

  const [color, setColor] = useState<string | null>(null)
  const [mixedColor, setMixedColor] = useState(false)
  const [opacity, setOpacity] = useState(defaultOpacity)
  const [mixedOpacity, setMixedOpacity] = useState(false)

  useEffect(() => {
    const colors = new Set<string | undefined>()
    selected.forEach((node) => {
      colors.add(node.elementContainer.element.properties?.color ?? defaultColor)
    })
    const mixed = colors.size > 1
    const commoncolor = mixed ? defaultColor : Array.from(colors.values())[0] || null
    setColor(commoncolor)
    setMixedColor(mixed)
  }, [selected])

  useEffect(() => {
    const opacities = Array.from(
      new Set<number>(
        selected
          .filter((node) => typeof node.elementContainer.element.properties?.opacity === "number")
          .map((node) => node.elementContainer.element.properties?.opacity),
      ),
    )
    const mixed = opacities.length > 1
    const commonOpacity = mixed ? 1 : opacities.shift() || defaultOpacity
    setOpacity(commonOpacity * 100)
    setMixedOpacity(mixed)
  }, [selected])

  const updateTerrainTextureColor = useCallback((color: string, paths: string[]) => {
    elementState.edit(({ updateElement }) => {
      paths.forEach((path) => {
        const currentChildNode = elementState.currentSnapshot.peek().getNode(path)
        if (!currentChildNode) throw new Error("Could not find the selected node")

        const terrainTexture = currentChildNode.elementContainer.representations.terrainTexture
        if (!terrainTexture) throw new Error("Missing terrain texture representation")
        const newTerrainTexture = { ...terrainTexture, properties: { ...terrainTexture.properties, color } }

        const newUrn = replaceRevision(currentChildNode.elementContainer.element.urn)
        const newElement = ElementContainer.fromDraftElement(
          {
            ...currentChildNode.elementContainer.element,
            urn: newUrn,
            properties: { ...currentChildNode.elementContainer.element.properties, color },
          },
          undefined,
          {
            ...currentChildNode.elementContainer.representations,
            terrainTexture: newTerrainTexture,
          },
        )
        updateElement(
          scenarioModeSignal.peek() ? "base" : "proposal",
          { ...currentChildNode?.child, urn: newUrn },
          newElement,
        )
      })
    })
  }, [])

  const updateBasicElementColor = useCallback(
    (color: string | null, paths: string[]) => {
      const partialTracking = partialTrackingDataForSelectionSignal.peek()

      const actions = BasicElementAPI.basicActionsToCoreActions(
        paths.map((path) => BasicElementAPI.updateProperties(path, { color: color ?? undefined })),
      )

      ActionsAPI.apply("Element - Change color", actions, {
        ...partialTracking,
        tool: "colorProperty",
        eventType: "update",
      })
    },
    [ActionsAPI],
  )

  const update3dsElementColor = useCallback((color: string | null, paths: string[]) => {
    elementState.edit(({ updateElement }) => {
      paths.forEach((path) => {
        const currentChildNode = elementState.currentSnapshot.peek().getNode(path)
        if (!currentChildNode) throw new Error("Could not find the selected node")

        const newUrn = replaceRevision(currentChildNode.elementContainer.element.urn)
        const newElement = ElementContainer.fromDraftElement(
          {
            ...currentChildNode.elementContainer.element,
            urn: newUrn,
            properties: { ...currentChildNode.elementContainer.element.properties, color },
          },
          currentChildNode.elementContainer.children,
          currentChildNode.elementContainer.representations,
        )
        updateElement(
          scenarioModeSignal.peek() ? "base" : "proposal",
          { ...currentChildNode?.child, urn: newUrn },
          newElement,
        )
      })
    })
  }, [])

  const updateTerrainTextureOpacity = useCallback((opacity: number, paths: string[]) => {
    opacity /= 100
    elementState.edit(({ updateElement }) => {
      paths.forEach((path) => {
        const currentChildNode = elementState.currentSnapshot.peek().getNode(path)
        if (!currentChildNode) throw new Error("Could not find the selected node")

        const terrainTexture = currentChildNode.elementContainer.representations.terrainTexture
        if (!terrainTexture) throw new Error("Missing terrain texture representation")
        const newTerrainTexture = { ...terrainTexture, properties: { ...terrainTexture.properties, opacity } }

        const newUrn = replaceRevision(currentChildNode.elementContainer.element.urn)
        const newElement = ElementContainer.fromDraftElement(
          {
            ...currentChildNode.elementContainer.element,
            urn: newUrn,
            properties: { ...currentChildNode.elementContainer.element.properties, opacity },
          },
          undefined,
          {
            ...currentChildNode.elementContainer.representations,
            terrainTexture: newTerrainTexture,
          },
        )
        updateElement(
          scenarioModeSignal.peek() ? "base" : "proposal",
          { ...currentChildNode?.child, urn: newUrn },
          newElement,
        )
      })
    })
  }, [])

  const updateBasicElementOpacity = useCallback(
    (opacity: number, paths: string[]) => {
      opacity /= 100

      const partialTracking = partialTrackingDataForSelectionSignal.peek()

      const actions = BasicElementAPI.basicActionsToCoreActions(
        paths.map((path) => BasicElementAPI.updateProperties(path, { opacity })),
      )

      ActionsAPI.apply("Element - Change opacity", actions, {
        ...partialTracking,
        tool: "opacityProperty",
        eventType: "update",
      })
    },
    [ActionsAPI],
  )

  const updateImportElementColor = useCallback((color: string | null, paths: string[]) => {
    elementState.edit(({ updateElement }) => {
      paths.forEach((path) => {
        const currentChildNode = elementState.currentSnapshot.peek().getNode(path)
        if (!currentChildNode) throw new Error("Could not find the selected node")

        const children = currentChildNode.elementContainer.element.children
        if (!children || children.length === 0) return

        // Update all children, not just the first one
        const updatedChildrenContainers: ElementContainer[] = []
        const updatedChildrenElements: typeof children = []

        children.forEach((child) => {
          if (!child.key) return

          const volumeChildNodePath = mergePath(path, child.key)
          const volumeChildNode = elementState.currentSnapshot.peek().getNode(volumeChildNodePath)
          if (!volumeChildNode) return

          const newVolumeUrn = replaceRevision(volumeChildNode.elementContainer.element.urn)

          // Update terrainShape features to include the new color
          const terrainShape = volumeChildNode.elementContainer.representations.terrainShape
          const updatedTerrainShape = terrainShape
            ? {
                ...terrainShape,
                features: terrainShape.features.map((feature) => ({
                  ...feature,
                  properties: {
                    ...feature.properties,
                    fill: {
                      ...feature.properties?.fill,
                      color: color ?? feature.properties?.fill?.color,
                    },
                  },
                })),
              }
            : undefined

          const newVolumeContainer = ElementContainer.fromDraftElement(
            {
              ...volumeChildNode.elementContainer.element,
              urn: newVolumeUrn,
              properties: { ...volumeChildNode.elementContainer.element.properties, color },
              metadata: {
                predecessor: volumeChildNode.elementContainer.isServerState
                  ? volumeChildNode.elementContainer.element.urn
                  : volumeChildNode.elementContainer.element.metadata?.predecessor,
              },
              representations: undefined,
            },
            volumeChildNode.elementContainer.children,
            {
              ...volumeChildNode.elementContainer.representations,
              terrainShape: updatedTerrainShape,
            },
          )

          updatedChildrenContainers.push(newVolumeContainer)
          updatedChildrenElements.push({
            ...child,
            urn: newVolumeUrn,
          })
        })

        if (updatedChildrenContainers.length === 0) return

        const newUrn = replaceRevision(currentChildNode.elementContainer.element.urn)

        const newElementContainer = ElementContainer.fromDraftElement(
          {
            ...currentChildNode.elementContainer.element,
            children: updatedChildrenElements,
            urn: newUrn,
            properties: { ...currentChildNode.elementContainer.element.properties, color },
            metadata: {
              predecessor: currentChildNode.elementContainer.isServerState
                ? currentChildNode.elementContainer.element.urn
                : currentChildNode.elementContainer.element.metadata?.predecessor,
            },
          },
          updatedChildrenContainers,
          currentChildNode.elementContainer.representations,
        )
        updateElement(currentChildNode.context, { ...currentChildNode?.child, urn: newUrn }, newElementContainer)
      })
    })
  }, [])

  const updateColor = useCallback(
    (color: string) => {
      const basicElementPaths = selected
        .filter((node) => isBasicElementUrn(node.elementContainer.element.urn))
        .map((node) => node.path)
      const rasterElementPaths = selected
        .filter((node) => isRasterElementUrn(node.elementContainer.element.urn))
        .map((node) => node.path)
      const i3dsElementPaths = selected
        .filter((node) => is3dSketchElementGeneric(node.elementContainer.element))
        .map((node) => node.path)
      const importElementPaths = selected
        .filter((node) => isImportElement(node.elementContainer.element))
        .map((node) => node.path)
      if (basicElementPaths.length) {
        updateBasicElementColor(color, basicElementPaths)
      }
      if (rasterElementPaths.length) {
        updateTerrainTextureColor(color, rasterElementPaths)
      }
      if (i3dsElementPaths.length) {
        update3dsElementColor(color, i3dsElementPaths)
      }
      if (importElementPaths.length) {
        updateImportElementColor(color, importElementPaths)
      }
    },
    [selected, updateBasicElementColor, updateTerrainTextureColor, update3dsElementColor, updateImportElementColor],
  )

  const updateOpacity = useCallback(
    (opacity: number) => {
      const basicElementPaths = selected
        .filter((node) => isBasicElementUrn(node.elementContainer.element.urn))
        .map((node) => node.path)
      const rasterElementPaths = selected
        .filter((node) => isRasterElementUrn(node.elementContainer.element.urn))
        .map((node) => node.path)
      if (basicElementPaths.length) {
        updateBasicElementOpacity(opacity, basicElementPaths)
      }
      if (rasterElementPaths.length) {
        updateTerrainTextureOpacity(opacity, rasterElementPaths)
      }
    },
    [updateBasicElementOpacity, updateTerrainTextureOpacity, selected],
  )

  const queueUpdate = useCallback(
    (color: string) => {
      setMixedOpacity(false)
      setColor(color)
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        updateColor(color)
      }, 300)
    },
    [updateColor],
  )

  const canEdit = canEditProposalSignal.value

  return color ? (
    <ColorProperties
      colorValue={color}
      opacityValue={opacity}
      mixedColor={mixedColor}
      mixedOpacity={mixedOpacity}
      disabled={!canEdit}
      showOpacity={showOpacity}
      onColorChange={(val) => queueUpdate(val)}
      onOpacityChange={(opacity) => {
        updateOpacity(opacity)
      }}
    />
  ) : null
}

export const ColorProperties = ({
  showOpacity,
  colorValue,
  opacityValue,
  disabled,
  mixedColor,
  mixedOpacity,
  onColorChange,
  onOpacityChange,
}: {
  disabled: boolean
  showOpacity: boolean
  colorValue: string
  opacityValue: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
  mixedColor: boolean
  mixedOpacity: boolean
}) => {
  const t = useTranslator()
  return (
    <RightMenuPanel>
      <label className={styles.Row}>
        <span className={styles.HeaderWithAddDeleteButton}>{t(($) => $.ui.color)}</span>
        {colorValue && (
          <div className={styles.ColorValue}>
            <span className={styles.ColorCode}>{mixedColor ? "Mixed" : colorValue.toUpperCase()}</span>
            <span
              className={styles.Picker}
              style={{ background: mixedOpacity ? defaultColor : colorValue, marginRight: showOpacity ? "6px" : "0" }}
            >
              <input
                type="color"
                value={colorValue}
                disabled={disabled}
                onInput={(e) => onColorChange(e.currentTarget.value)}
              />
            </span>
            {showOpacity && (
              <UnitInput
                onChange={onOpacityChange}
                min={0}
                max={100}
                step={10}
                unit={"%"}
                id={"opacity"}
                isMixed={mixedOpacity}
                value={opacityValue}
                accessAware={true}
              />
            )}
          </div>
        )}
      </label>
    </RightMenuPanel>
  )
}
