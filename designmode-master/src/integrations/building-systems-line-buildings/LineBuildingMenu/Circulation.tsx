import { AddContentButton } from "./MenuStyles"
import { CirculationTile } from "./CirculationTile"

import { ContentHeader } from "./ContentMenu"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import { useMemo } from "preact/compat"
import { ReleaseToFloorPlanTooltip } from "./ReleaseToFloorPlanTooltip"
import { AnalyticsLegacy } from "src/core/analytics"
import { useIsImperial } from "src/lib/unitSettings"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

export const FEATURES = {
  Circulation: (imperialFlag: boolean) => {
    return {
      id: "asdfghjkl",
      name: "Circulation",
      settings: {
        corridorWidth: { name: "corridorWidth", value: imperialFlag ? toMetersIfImperial(6, imperialFlag) : 2 },
        corridorAlignment: { name: "corridorAlignment", value: "center" },
        endBuffer: { name: "endBuffer", value: 0 },
        cores: { name: "cores", value: false },
        coreWidth: { name: "coreWidth", value: imperialFlag ? toMetersIfImperial(18, imperialFlag) : 6 },
      },
    }
  },
}

export const CirculationContent = ({
  features,
  updateFeatureSetting,
  bakeFeature,
  removeFeature,
  addFeature,
  showAdd,
}: {
  features: any
  updateFeatureSetting: any
  bakeFeature: any
  removeFeature: any
  addFeature: any
  showAdd: boolean
}) => {
  const imperialFlag = useIsImperial()
  const circulationFeature = features?.Presets?.Circulation

  const DefaultCirculationFeature = useMemo(() => {
    return FEATURES.Circulation(imperialFlag)
  }, [imperialFlag])

  return (
    <>
      <ContentHeader
        headerText={"Circulation"}
        releaseCallback={
          bakeFeature?.canBake
            ? () => {
                bakeFeature.bake()
              }
            : undefined
        }
        addCallback={
          showAdd
            ? () => {
                AnalyticsLegacy.track("Line Building - Add circulation")
                dispatchBuildingEvent("line_building", EventName.Edit, undefined, {
                  sub_feature: "circulation",
                  edit_type: "add_circulation",
                })
                addFeature(DefaultCirculationFeature, true)
              }
            : undefined
        }
        releaseTooltip={<ReleaseToFloorPlanTooltip targetId="release-to-floor-plan-header-icon-button" />}
      />
      <CirculationTile
        feature={circulationFeature}
        updateFeatureSetting={updateFeatureSetting}
        bakeFeature={bakeFeature}
        removeFeature={() => removeFeature(circulationFeature.name)}
      />
    </>
  )
}

export const CirculationAddButton = ({ addFeature }: any) => {
  const t = useTranslator()
  const imperialFlag = useIsImperial()

  const DefaultCirculationFeature = useMemo(() => {
    return FEATURES.Circulation(imperialFlag)
  }, [imperialFlag])

  return (
    <AddContentButton
      title={t(($) => $.building.lineBuilding.circulationTitle)}
      addCallback={() => {
        AnalyticsLegacy.track("Line Building - Add circulation")
        dispatchBuildingEvent("line_building", EventName.Edit, undefined, {
          sub_feature: "circulation",
          edit_type: "add_circulation",
        })
        addFeature(DefaultCirculationFeature, true)
      }}
    />
  )
}
