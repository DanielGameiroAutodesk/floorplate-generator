import { useCallback, useMemo, useRef } from "preact/compat"
import type { ToolSpec } from "./ToolbarButton"
import styles from "./ToolbarButtonWithMenu.module.pcss"
import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"
import { buttonDisplaySignal, titleDisplaySignal } from "src/integrations/toolbar/ToolbarAPI"
import { OutlineArrow } from "./OutlineArrow"
import { useTranslator, type I18nStringProvider } from "src/i18n"

type Props = Omit<ToolSpec, "shortCut"> & {
  menuContent: JSX.Element
  menuTitle: I18nStringProvider
  openMenu: boolean
  id?: string
}

export default function ToolbarButtonWithMenu(props: Props) {
  const t = useTranslator()
  const overrideToolbarTitle = t.getText(titleDisplaySignal.value) === t.getText(props.menuTitle)
  const id = `${t.getText(props.label).replaceAll(" ", "")}-button`
  const handleOnClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      props.onClick()
    },
    [props],
  )

  const menuClasses = useMemo(() => {
    const classes = [styles.floatingMenuTopCenter]

    if (props.openMenu) {
      classes.push(styles.open)
    }

    return classes.join(" ")
  }, [props.openMenu])

  const { onMouseOver, onMouseOut, onMouseMove } = props

  return (
    <div
      onMouseEnter={onMouseOver as JSX.MouseEventHandler<HTMLDivElement>}
      onMouseLeave={onMouseOut as JSX.MouseEventHandler<HTMLDivElement>}
      onMouseMove={onMouseMove as JSX.MouseEventHandler<HTMLDivElement>}
      style={{ display: "flex", alignItems: "center", gap: "4px", position: "relative" }}
      id={props.id}
    >
      <forma-toolbar-button
        id={id}
        onClick={handleOnClick}
        active={props.active}
        onChange={(e) => {
          e.preventDefault()
        }}
        disabled={props.disabled}
      >
        <>{props.icon}</>
      </forma-toolbar-button>
      {(overrideToolbarTitle || props.openMenu) && (
        <div className={menuClasses}>
          <forma-toolbar-overflow-menu label={t.getText(props.menuTitle)}>
            {props.menuContent}
          </forma-toolbar-overflow-menu>
        </div>
      )}
      <OutlineArrow />
    </div>
  )
}

export const ToolbarButtonInMenu = (props: ToolSpec) => {
  const t = useTranslator()
  const overrideToolbarButton = t.getText(buttonDisplaySignal.value) === t.getText(props.label)
  const buttonRef = useRef<HTMLElement>(null)

  const handleOnClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      if (!props.disabled) {
        props.onClick()
      }
    },
    [props],
  )

  return (
    <>
      <forma-toolbar-overflow-button
        ref={buttonRef}
        style={{ opacity: props.disabled ? "0.5" : "1" }}
        disabled={props.disabled}
        label={t.getText(props.label)}
        onClick={handleOnClick}
        onMouseOver={(e) => {
          props.onMouseOver && props.onMouseOver(e)
        }}
        onMouseOut={(e) => {
          props.onMouseOut && props.onMouseOut(e)
        }}
        shortcut={props.shortCut}
        active={overrideToolbarButton || props.active}
        highlighted={props.highlighted}
        id={t.getText(props.label)} // needed to have target for the expanded tooltip
      >
        {props.icon}
      </forma-toolbar-overflow-button>
      {props.expandedTooltip && (
        <ExpandedTooltip
          {...props.expandedTooltip}
          visible={overrideToolbarButton}
          target={t.getText(props.label)}
          shortcut={props.expandedTooltip.shortcut ?? props.shortCut}
        />
      )}
    </>
  )
}
