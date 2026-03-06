import { useCallback, useEffect, useState } from "preact/hooks"
import { Vector2 } from "three"
import { isDefined } from "src/lib/array"
import LengthInput from "src/integrations/inputs/LengthInput"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { isBasicFeature } from "src/lib/geometry/geometryTypes"
import { metricMinDefault } from "src/lib/components/LengthInput/formaUnitUtils"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useTranslator, type Translator } from "src/i18n"

import { isReferenceImage } from "src/integrations/tools-common/Transform2D/EditReferenceImage"
import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import type { InternalPath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"

import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"
import { useIsImperial } from "src/lib/unitSettings"

const vec2a = new Vector2()
const vec2b = new Vector2()
const errorMargin = 1e-5

export function isRectangular(feature: BasicFeature): boolean {
  if (feature.geometry.type !== "Polygon") return false
  const footprint = feature.geometry.coordinates[0]
  if (footprint.length !== 5) return false // last vertex is same as first
  if (footprint[0][0] !== footprint[4][0] || footprint[0][1] !== footprint[4][1]) return false
  const [v1, v2, v3, v4] = footprint
  vec2a.set(v2[0] - v1[0], v2[1] - v1[1])
  vec2b.set(v3[0] - v2[0], v3[1] - v2[1])
  if (Math.abs(vec2a.dot(vec2b)) > errorMargin) return false
  vec2a.set(v4[0] - v3[0], v4[1] - v3[1])
  vec2b.set(v1[0] - v4[0], v1[1] - v4[1])
  if (Math.abs(vec2a.dot(vec2b)) > errorMargin) return false
  return true
}

function getWidth(feature: BasicFeature | undefined) {
  if (feature?.geometry.type !== "Polygon") return
  const footprint = feature.geometry.coordinates[0]
  const [v1, v2] = footprint
  const v1v2 = [v2[0] - v1[0], v2[1] - v1[1]]
  return (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
}

function getLength(feature: BasicFeature | undefined) {
  if (feature?.geometry.type !== "Polygon") return
  const footprint = feature.geometry.coordinates[0]
  const [, v1, v2] = footprint
  const v1v2 = [v2[0] - v1[0], v2[1] - v1[1]]
  return (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
}

const newWidth = new Vector2()

function setGeoJsonWidth(feature: BasicFeature, width: number) {
  // move v2 and v3
  if (feature.geometry.type !== "Polygon" || !isRectangular(feature)) return
  const footprint = feature.geometry.coordinates[0]
  const [v1, v2, , v4, v5] = footprint
  const v1v2 = [v2[0] - v1[0], v2[1] - v1[1]] as [number, number]
  const currentWidth = (v1v2[0] ** 2 + v1v2[1] ** 2) ** 0.5
  newWidth.set(...v1v2).multiplyScalar(width / currentWidth)
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [[v1, [v1[0] + newWidth.x, v1[1] + newWidth.y], [v4[0] + newWidth.x, v4[1] + newWidth.y], v4, v5]],
    },
  } as typeof feature
}

const newLength = new Vector2()

function setGeoJsonLength(feature: BasicFeature, length: number) {
  // move v2 and v3
  if (feature.geometry.type !== "Polygon" || !isRectangular(feature)) return
  const footprint = feature.geometry.coordinates[0]
  const [v1, v2, , v4, v5] = footprint
  const v1v4 = [v4[0] - v1[0], v4[1] - v1[1]] as [number, number]
  const currentLength = (v1v4[0] ** 2 + v1v4[1] ** 2) ** 0.5
  newLength.set(...v1v4).multiplyScalar(length / currentLength)
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [
        [v1, v2, [v2[0] + newLength.x, v2[1] + newLength.y], [v1[0] + newLength.x, v1[1] + newLength.y], v5],
      ],
    },
  } as typeof feature
}

function selectedWidths(t: Translator, selected: BasicFeaturePathInfo[]) {
  const allWidths = new Set(
    selected
      .map(({ geojson }) => getWidth(geojson))
      .filter(isDefined)
      .map((v) => Number(v?.toFixed(8))),
  )

  const [first] = allWidths
  return allWidths.size === 1 ? first : t(($) => $.properties.mixed)
}

function selectedLengths(t: Translator, selected: BasicFeaturePathInfo[]) {
  const allLengths = new Set(
    selected
      .map(({ geojson }) => getLength(geojson))
      .filter(isDefined)
      .map((v) => Number(v?.toFixed(8))),
  )

  const [first] = allLengths
  return allLengths.size === 1 ? first : t(($) => $.properties.mixed)
}

const numberLikeEquals = (a: string | number | undefined, b: string | number | undefined) => {
  return Math.abs(parseFloat(`${a}`) - parseFloat(`${b}`)) < errorMargin
}

function RectangleProperty({
  selectedIds,
  currentValue,
  getNewFeature,
  name,
  gridOffset = 1,
}: {
  selectedIds: InternalPath[]
  currentValue: number | string
  getNewFeature: (old: BasicFeature, property: number) => BasicFeature | undefined
  name: string
  gridOffset?: number
}) {
  const [property, setProperty] = useState<string | number>(currentValue)
  const isImperial = useIsImperial()
  const t = useTranslator()

  useEffect(() => {
    if (numberLikeEquals(property, currentValue)) return
    setProperty(currentValue)
  }, [property, currentValue])

  const actionAPI = useActionAPI()

  const onPropertySubmit = useCallback(
    (newValue: number) => {
      if (isNaN(newValue) || newValue < errorMargin) return
      setProperty(newValue)

      const snapshot = elementState.currentSnapshot.peek()

      const updates = selectedIds.flatMap((path): BasicAction => {
        const node = snapshot.getNodeOrThrow(path)
        const feature = node.elementContainer.getRepresentationOrThrow("footprint")
        if (!isBasicFeature(feature)) {
          throw new Error("Not a basic feature")
        }
        const newFeature: BasicFeature = getNewFeature(feature, newValue)!

        return BasicElementAPI.updateFeature(path, newFeature)
      })

      const actions = BasicElementAPI.basicActionsToCoreActions(updates)
      actionAPI.apply("Change rectangle size", actions, {
        ...partialTrackingDataForSelectionSignal.peek(),
        eventType: "update",
        tool: "rectangleProperty",
      })
    },
    [actionAPI, getNewFeature, selectedIds],
  )

  const id = `${name}_input`

  const isMixed = property === t(($) => $.properties.mixed)
  return (
    <>
      <weave-tooltip text={name} style={{ gridColumn: `${gridOffset}/${gridOffset + 1}` }} nub="right-center">
        <label className={labelClassName} htmlFor={id}>
          {name.slice(0, 1)}
        </label>
      </weave-tooltip>
      <LengthInput
        style={{ gridColumn: `${gridOffset + 1}/${gridOffset + 2}` }}
        metricValue={isMixed ? undefined : typeof property === "string" ? parseFloat(property) : property}
        onBlur={onPropertySubmit}
        id={id}
        isMixed={isMixed}
        accessAware={true}
        metricMin={metricMinDefault(isImperial)}
      />
    </>
  )
}

function RectangleProperties({ selected }: { selected: BasicFeaturePathInfo[] }) {
  const t = useTranslator()
  if (selected.some((elm) => isReferenceImage(elm.element))) return null //Don't show for reference images
  return (
    <RightMenuGridPanel>
      <RectangleProperty
        selectedIds={selected.map((_) => _.path)}
        currentValue={selectedWidths(t, selected)}
        getNewFeature={setGeoJsonWidth}
        name={t(($) => $.properties.width)}
      />
      <RectangleProperty
        selectedIds={selected.map((_) => _.path)}
        currentValue={selectedLengths(t, selected)}
        getNewFeature={setGeoJsonLength}
        name={t(($) => $.properties.length)}
        gridOffset={4}
      />
    </RightMenuGridPanel>
  )
}

export default RectangleProperties
