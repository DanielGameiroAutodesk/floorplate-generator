import { useState } from "preact/compat"
import { icons } from "./icons"
import { CirculationTileMenu } from "./TileMenus/CirculationTileMenu"
import { useEffect, useRef } from "preact/hooks"
import { toFeetIfImperial } from "src/lib/measurementSystem"
import { useTranslator } from "src/i18n"
import { ReleaseToFloorPlanTooltip } from "./ReleaseToFloorPlanTooltip"
import { HamburgerIcon } from "src/lib/components/icons/HamburgerIcon"
import { useIsImperial } from "src/lib/unitSettings"

const FeatureBodyBoxStyle = (hover: boolean) => `
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 68px;
  border: 1px solid rgba(60, 60, 60, 0.1);

  display: flex;
  align-items: center;
  cursor: pointer;
  ${hover ? "background: var(--background-color-ghost-high-hover);" : ""}
  padding: 12px;
`

const FeatureBodyIconStyle = `
  height: 100%;
  width: 24px;
`

const FeatureBodyTextItemsStyle = `
  padding-left: 12px;

  display: flex;
  flex-direction: column;
  align-items: left;
  justify-content: space-between;
`

const FeatureBodyTextItemStyle = `
  font: var(--11-regular);
`

const FeatureBodyTextHeaderStyle = `
  font: var(--11-medium);
`

const HamburgerStyle = `
  position: absolute;
  right: 12px;
  top: 12px;
  display: flex;
`

const featureIcons: any = {
  SetBacks: icons.setBackFeature,
  Circulation: icons.CirculationFeature,
  default: icons.setBackFeature,
}

export function getCorridorType(corridorAlignment: any) {
  return corridorAlignment === "center" ? "Double loaded" : "Single loaded"
}

export const CirculationTile = ({ feature, updateFeatureSetting, bakeFeature, removeFeature }: any) => {
  const t = useTranslator()
  const imperial = useIsImperial()
  const corridorType = getCorridorType(feature.settings.corridorAlignment.value)
  const [openTopPosition, setOpenTopPosition] = useState<number | undefined>(undefined)
  const [contextMenuPos, setContextMenuPos] = useState<undefined | { top: number; left: number }>(undefined)
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const keyup = (e: KeyboardEvent) => {
      if ((contextMenuPos || openTopPosition) && e.key === "Escape") {
        e.stopPropagation()
        setContextMenuPos(undefined)
        setOpenTopPosition(undefined)
      }
    }
    window.addEventListener("keyup", keyup)
    return () => window.removeEventListener("keyup", keyup)
  }, [contextMenuPos, openTopPosition])

  useEffect(() => {
    if (openTopPosition === undefined) {
      setHover(false)
    }
  }, [openTopPosition])

  return (
    <div
      ref={ref}
      style={FeatureBodyBoxStyle(hover)}
      onClick={(e) => {
        setOpenTopPosition(
          openTopPosition === undefined ? ref.current?.getBoundingClientRect().top || e.clientY : undefined,
        )
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => {
        setContextMenuPos({ top: e.clientY, left: e.clientX })
        e.preventDefault()
      }}
    >
      <div style={FeatureBodyIconStyle}>{featureIcons[feature.name] || featureIcons.default}</div>
      <div style={FeatureBodyTextItemsStyle}>
        <div style={FeatureBodyTextHeaderStyle}>{corridorType}</div>
        <div style={FeatureBodyTextItemStyle}>
          {t(($) => $.building.lineBuilding.circulation.sectionCountText, { count: feature.count })}
        </div>
        <div style={FeatureBodyTextItemStyle}>
          {t(($) => $.building.lineBuilding.circulation.widthText, {
            width: toFeetIfImperial(feature.settings["corridorWidth"].value, imperial) + (imperial ? "ft" : "m"),
          })}
        </div>
      </div>
      <div
        style={HamburgerStyle}
        slot={"icon"}
        onClick={(e) => {
          setContextMenuPos({ top: e.clientY, left: e.clientX })
          e.stopPropagation()
        }}
      >
        {<HamburgerIcon />}
      </div>
      {openTopPosition !== undefined && (
        <CirculationTileMenu
          top={openTopPosition}
          feature={feature}
          updateFeatureSetting={updateFeatureSetting}
          close={() => {
            setOpenTopPosition(undefined)
          }}
        />
      )}
      {contextMenuPos && (
        <div
          style={`position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100001;`}
          onClick={(e) => {
            setContextMenuPos(undefined)
            e.stopPropagation()
          }}
        >
          <forma-context-menu-container
            left={contextMenuPos.left - 120}
            top={contextMenuPos.top}
            onClose={() => close()}
          >
            <forma-context-menu>
              {bakeFeature?.canBake && (
                <>
                  <forma-context-menu-item
                    text={t(($) => $.building.lineBuilding.releaseToFloorPlanAction)}
                    id="release-to-floor-plan-context-menu-item"
                    onClick={(e) => {
                      bakeFeature.bake()
                      e.stopPropagation()
                      setContextMenuPos(undefined)
                    }}
                  />
                  <ReleaseToFloorPlanTooltip targetId="release-to-floor-plan-context-menu-item" />
                </>
              )}
              {!openTopPosition && (
                <forma-context-menu-item
                  text={t(($) => $.ui.edit)}
                  onClick={(e) => {
                    setOpenTopPosition(
                      openTopPosition === undefined ? ref.current?.getBoundingClientRect().top || e.clientY : undefined,
                    )
                    e.stopPropagation()
                    setContextMenuPos(undefined)
                  }}
                />
              )}
              <forma-context-menu-divider></forma-context-menu-divider>
              <forma-context-menu-item
                text={t(($) => $.ui.delete)}
                onClick={(e) => {
                  removeFeature()
                  e.stopPropagation()
                  setContextMenuPos(undefined)
                }}
              />
            </forma-context-menu>
          </forma-context-menu-container>
        </div>
      )}
    </div>
  )
}
