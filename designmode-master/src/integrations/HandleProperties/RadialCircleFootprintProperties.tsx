import { useMemo } from "preact/compat"
import LengthInput from "src/integrations/inputs/LengthInput"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { useCallback } from "preact/hooks"
import { Vector3 } from "three"
import { isDefined, uniq } from "src/lib/array"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import CircleIcon from "./CircleIcon"
import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import { metricMinDefault } from "src/lib/components/LengthInput/formaUnitUtils"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { shapeToPolygonFeature } from "src/lib/three/Shape/shapeUtils"
import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"
import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

const ID = "radialCircleRadius"
export const RadialCircleFootprintProperties = ({ selected }: { selected: BasicFeaturePathInfo[] }) => {
  const t = useTranslator()
  const isImperial = useIsImperial()

  const actionAPI = useActionAPI()

  const radius: undefined | number = useMemo(() => {
    const existingRadiuses = uniq(
      selected
        .map((sel) => {
          const circleDefinition = sel.element.properties?.circleDefinition
          const start = new Vector3().fromArray(circleDefinition[0])
          const end = new Vector3().fromArray(circleDefinition[1])
          return Number(start.distanceTo(end).toFixed(8)) //Handle floating point differences
        })
        .filter(isDefined),
    )
    if (existingRadiuses.length === 0) return 0
    if (existingRadiuses.length > 1) return undefined

    return existingRadiuses[0]
  }, [selected])

  const partialTrackingData = partialTrackingDataForSelectionSignal.value

  const onSubmitRadius = useCallback(
    (newRadius: number) => {
      const trackingData = {
        ...partialTrackingData,
        tool: "radialCircleProperties",
        eventType: "update",
      }

      const basicActions = selected.map((pathinfo) => {
        const { path, element, geojson } = pathinfo
        const existingSegment = element.properties!.circleDefinition!
        const start = new Vector3().fromArray(existingSegment[0])
        const end = new Vector3().fromArray(existingSegment[1])
        const newEnd = new Vector3().subVectors(end, start).normalize().multiplyScalar(newRadius).add(start)
        const segment = [start.toArray(), newEnd.toArray()]
        const shape = circleFrom2Points(segment[0], segment[1])

        const feature = shapeToPolygonFeature(shape)
        feature.properties = {
          ...geojson.properties,
          ...feature.properties,
        }

        return BasicElementAPI.update(path, { circleDefinition: segment }, feature)
      })

      const actions = BasicElementAPI.basicActionsToCoreActions(basicActions)
      actionAPI.apply("Update radius", actions, trackingData)
    },
    [partialTrackingData, selected, actionAPI],
  )

  return (
    <RightMenuGridPanel>
      <weave-tooltip text={t(($) => $.properties.radius)} style={{ gridColumn: "1/2" }} nub="right-center">
        <label className={labelClassName} htmlFor={ID}>
          <CircleIcon />
        </label>
      </weave-tooltip>
      <LengthInput
        style={{ gridColumn: "2/3" }}
        metricValue={radius || parseFloat("")}
        id={ID}
        onBlur={onSubmitRadius}
        isMixed={radius === undefined}
        accessAware={true}
        metricMin={metricMinDefault(isImperial)}
        metricStep={0.1}
        feetStep={0.5}
      />
    </RightMenuGridPanel>
  )
}
