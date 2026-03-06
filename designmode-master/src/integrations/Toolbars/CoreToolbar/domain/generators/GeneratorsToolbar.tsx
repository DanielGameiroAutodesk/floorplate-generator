import { useRef, useState } from "preact/hooks"
import { useGeneratorsAndExtension } from "src/integrations/extensions-generators/generator-service"
import ToolbarButtonWithMenu, {
  ToolbarButtonInMenu,
} from "src/integrations/toolbar/ToolbarButton/ToolbarButtonWithMenu"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { useCallback } from "preact/compat"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"
import { dispatchOpenAppStore } from "src/integrations/app-store-window-events/dispatchers"
import { explicitSignalWithReset } from "src/lib/signal"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export const [generatorIdSignal, setGeneratorIdSignalValue] = explicitSignalWithReset<string | undefined>(undefined)

function CreateGeneratorToolbar() {
  return (
    <ToolbarCloseButton
      onClick={() => {
        setGeneratorIdSignalValue(undefined)
        exitCurrentTool()
      }}
    />
  )
}

function AddExtensionsButton() {
  const onClick = () => {
    dispatchOpenAppStore("generators-toolbar")
  }
  return (
    <div style={{ width: "200px", margin: "10px 10px 2px" }}>
      <weave-button variant="solid" style={{ width: "100%" }} iconposition="left" onClick={onClick}>
        <weave-solid-plus-operator style={{ marginRight: "6px" }} slot="icon" />
        Add extension
      </weave-button>
    </div>
  )
}

export const CREATE_GENERATORS_TOOL_CFG: ToolCfg = {
  id: "createGeneratorElement",
  tool: () => null,
  toolbar: () => <CreateGeneratorToolbar />,
  propertyPanel: "default",
}

export const EDIT_GENERATORS_TOOL_CFG: ToolCfg = {
  id: "editGeneratorElement",
  tool: () => null,
  toolbar: () => <ToolbarCloseButton />,
  propertyPanel: "default",
}

const noop = () => undefined
const emptyList: never[] = []

export const ExtensionsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.7992 1.58035C11.6346 1.47372 11.4228 1.47319 11.2577 1.57901L6.23026 4.80009C6.08678 4.89202 6 5.05069 6 5.22109V9.76791L1.23026 12.8239C1.08678 12.9158 1 13.0745 1 13.2449V18.0674C1 18.2378 1.08677 18.3964 1.23024 18.4884L6.25766 21.7098C6.42284 21.8156 6.63464 21.8151 6.79928 21.7085L11.5015 18.6622L16.2577 21.7098C16.4228 21.8156 16.6346 21.8151 16.7993 21.7085L21.7719 18.487C21.9141 18.3948 22 18.2369 22 18.0674V13.2446C22 13.075 21.9141 12.9171 21.7718 12.8249L17 9.73418V5.22076C17 5.05124 16.9141 4.89326 16.7718 4.8011L11.7992 1.58035ZM12.4663 13.2525L16.529 10.6205L20.5673 13.2361L16.526 15.7512L12.4663 13.2525ZM6.49827 10.6363L10.5613 13.2398L6.52597 15.7512L2.44009 13.2364L6.49827 10.6363ZM16 9.76791V6.12086L12.0274 8.59319V12.3132L16 9.76791ZM11.0274 12.3428V8.59482L7 6.11596V9.73418L11.0274 12.3428ZM11.526 7.72743L15.5673 5.21234L11.526 2.59477L7.44009 5.21259L11.526 7.72743ZM12 17.7939V14.1398L16.0274 16.6186V20.3746L12 17.7939ZM7.02742 16.617L11 14.1447V17.7955L7.02742 20.3691V16.617ZM2 14.1398V17.7939L6.02742 20.3746V16.6186L2 14.1398ZM17.0274 16.617V20.3691L21 17.7955V14.1447L17.0274 16.617Z"
      fill="currentColor"
    />
  </svg>
)

export function GeneratorsToolbar() {
  const [open, setOpen] = useState(false)
  const mouseOutTimeout = useRef<ReturnType<typeof setTimeout> | undefined>()
  const toolbarMouseLeave = useCallback(() => {
    mouseOutTimeout.current = setTimeout(() => setOpen(false), 200)
  }, [])

  const toolbarMouseEnter = useCallback(() => {
    clearTimeout(mouseOutTimeout.current)
    setOpen(true)
  }, [])

  const generators = useGeneratorsAndExtension() ?? emptyList

  return (
    <ToolbarButtonWithMenu
      label={(t) => t(($) => $.menus.generatorsByExtensions)}
      icon={<ExtensionsIcon />}
      onMouseOver={toolbarMouseEnter}
      onMouseOut={toolbarMouseLeave}
      onClick={noop}
      menuTitle={(t) => t(($) => $.menus.generatorsByExtensions)}
      openMenu={open}
      menuContent={
        <>
          {generators.map(({ generator, extension }) => {
            const iconSrc = extension.resources.logo

            return (
              <ToolbarButtonInMenu
                key={generator.id}
                icon={
                  iconSrc ? (
                    <img
                      src={iconSrc}
                      alt={generator.name}
                      style="width: 24px; height: 24px; object-fit: cover; display: block"
                    />
                  ) : (
                    <></>
                  )
                }
                label={() => generator.name}
                onClick={() => {
                  AnalyticsLegacy.trackSelectTool(AnalyticsTools.ExtensionGenerator, "toolbar", {
                    generatorId: generator.id,
                  })
                  Analytics.track(EventName.Select, {
                    feature_category: FeatureCategory.Extension,
                    feature: "generator",
                    object_id: generator.id,
                  })
                  toolAPI.setTool(CREATE_GENERATORS_TOOL_CFG)
                  setGeneratorIdSignalValue(generator.id)
                }}
              />
            )
          })}
          <AddExtensionsButton />
        </>
      }
    />
  )
}
