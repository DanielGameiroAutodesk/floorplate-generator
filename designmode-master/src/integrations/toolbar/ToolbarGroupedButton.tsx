import ToolbarButtonWithMenu, { ToolbarButtonInMenu } from "./ToolbarButton/ToolbarButtonWithMenu"
import { atomFamily, useRecoilState } from "recoil"
import type { ExpandedTooltipSpec } from "src/lib/components/ExpandedTooltip"
import { signal, useSignal } from "@preact/signals"
import { useMemo } from "preact/compat"
import { useTranslator, type I18nStringProvider } from "src/i18n"

export type ToolConfig = {
  label: I18nStringProvider
  icon: () => JSX.Element
  shortCut?: string
  disabled?: boolean
  onClick?: () => void
  expandedTooltip?: ExpandedTooltipSpec
  active?: boolean
  toolType?: FormIt.ToolType
  command?: string
}

type Props = {
  id: string
  configs: ToolConfig[]
  title: I18nStringProvider
  active?: boolean
}

/**
 * Yes, this logic is over-engineered like hell, but there is some reason behind it.
 *
 * If the user moves the mouse from the toolbar button to the submenu, it is easy to hover another toolbar button
 * on the way. This code deals with that case and keeps the current submenu open
 *
 * 1. If the movement direction ration the last MOVEMENT_TIMESPAN is below the VERTICAL_HORIZONTAL_RATIO, we assume the
 *    user wants to move the mouse into the submenu. We delay the change of hovered toolbar button with
 *    OPEN_ANYWAYS_DELAY
 * 2. If the movement is purely vertical (above VERTICAL_HORIZONTAL_RATIO), we change immediately
 */

const MOVEMENT_TIMESPAN = 200
const CLOSE_DELAY = 500
const OPEN_ANYWAYS_DELAY = 200
const VERTICAL_HORIZONTAL_RATIO = 3

const openMenuSignal = signal<string | undefined>(undefined)
let isClosing = false
let isChanging = false

let leavingPos: { x: number; y: number } | undefined
let movement: { x: number; y: number } | undefined

// See comment above
function mouseMove(e: MouseEvent) {
  setTimeout(() => {
    leavingPos = { x: e.clientX, y: e.clientY }
  }, MOVEMENT_TIMESPAN)
  if (leavingPos) {
    movement = { x: e.clientX - leavingPos.x, y: e.clientY - leavingPos.y }
  }
}

// See comment above
function closeMenu() {
  if (!isClosing) {
    isClosing = true
    setTimeout(() => {
      if (isClosing) {
        openMenuSignal.value = undefined
      }
    }, CLOSE_DELAY)
  }
}

// See comment above
function openMenu(key: string) {
  if (openMenuSignal.peek() && key !== openMenuSignal.peek()) {
    isChanging = true
    if (movement && movement.x < 0 && Math.abs(movement.y) / Math.abs(movement.x) < VERTICAL_HORIZONTAL_RATIO) {
      setTimeout(() => {
        if (isChanging) {
          isClosing = false // If we still want to change
          openMenuSignal.value = key
          isChanging = false
        }
      }, OPEN_ANYWAYS_DELAY)
    } else {
      openMenuSignal.value = key
      isClosing = false
      isChanging = false
    }
  } else {
    openMenuSignal.value = key
    isClosing = false
    isChanging = false
  }
}

const defaultToolForGroupState = atomFamily<number, string>({
  key: "defaultToolForGroupState",
  default: 0,
})

export const ToolbarGroupedButton = ({ configs, title, id, active = false }: Props) => {
  const t = useTranslator()
  const [defaultTool, setDefaultTool] = useRecoilState(defaultToolForGroupState(id))

  const defaultCfg = configs[defaultTool]

  const openState = openMenuSignal.value
  const isOpen = useMemo(() => openState === id, [id, openState])

  const isToolbarMenuHoveredSignal = useSignal<boolean>(false)

  return (
    <ToolbarButtonWithMenu
      label={defaultCfg.label}
      icon={<defaultCfg.icon />}
      active={active}
      onMouseOver={() => openMenu(id)}
      onMouseOut={() => closeMenu()}
      onMouseMove={mouseMove}
      onClick={() => {
        defaultCfg?.onClick?.()
        openMenuSignal.value = undefined
      }}
      id={id}
      menuTitle={title}
      openMenu={isOpen}
      menuContent={
        <div
          onMouseOver={() => {
            isToolbarMenuHoveredSignal.value = true
          }}
          onMouseOut={() => {
            isToolbarMenuHoveredSignal.value = false
          }}
        >
          {configs.map((cfg, i) => {
            const { label, onClick, icon: Icon, shortCut, expandedTooltip, disabled, active } = cfg
            return (
              <ToolbarButtonInMenu
                key={t.getText(label)}
                expandedTooltip={expandedTooltip}
                icon={<Icon />}
                label={label}
                disabled={!!disabled}
                active={active}
                highlighted={isToolbarMenuHoveredSignal.value === false && defaultTool === i}
                onClick={() => {
                  openMenuSignal.value = undefined
                  onClick?.()
                  // set default tool to 0 if the user clicks the import button
                  if (t.getText(label) === t(($) => $.importToolbar.title)) {
                    setDefaultTool(0)
                  } else {
                    setDefaultTool(i)
                  }
                }}
                shortCut={shortCut}
              />
            )
          })}
        </div>
      }
    />
  )
}
