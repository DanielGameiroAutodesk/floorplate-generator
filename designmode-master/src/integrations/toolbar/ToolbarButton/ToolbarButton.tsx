import { useCallback } from "preact/compat"
import type { VNode } from "preact"
import { useTranslator, type I18nStringProvider } from "src/i18n"

import type { ExpandedTooltipSpec } from "src/lib/components/ExpandedTooltip"
import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"
import { exitCurrentTool } from "src/core/toolsState"
import { canEditProposalSignal } from "src/core/edit-access-state"

export type ToolSpec = {
  icon: VNode
  label: I18nStringProvider
  onClick: (e?: MouseEvent) => void
  disabled?: boolean
  active?: boolean
  highlighted?: boolean
  shortCut?: string
  expandedTooltip?: ExpandedTooltipSpec
  onMouseOver?: (e: MouseEvent) => void
  onMouseOut?: (e: MouseEvent) => void
  onMouseMove?: (e: MouseEvent) => void
}

export function ToolbarCloseButton({ onClick, label }: { onClick?: () => void; label?: string }) {
  const t = useTranslator()
  const defaultLabel = t(($) => $.modes.exitDrawingModeAction)

  return (
    <weave-tooltip text={label || defaultLabel} nub="up-center" style={{ lineHeight: 0 }}>
      <forma-toolbar-close-button onClick={onClick || exitCurrentTool} />
    </weave-tooltip>
  )
}

export default function ToolbarButton(props: ToolSpec) {
  const t = useTranslator()
  const id = `${t.getText(props.label).replaceAll(" ", "")}-button`
  const handleOnClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      props.onClick(e)
    },
    [props],
  )

  return (
    <weave-tooltip
      nub="up-center"
      text={t.getText(props.label)}
      shortcutmac={props.shortCut}
      shortcutwindows={props.shortCut}
    >
      {props.expandedTooltip && (
        <ExpandedTooltip
          {...props.expandedTooltip}
          target={id}
          shortcut={props.expandedTooltip.shortcut || props.shortCut}
        />
      )}
      <forma-toolbar-button
        id={id}
        onClick={handleOnClick}
        active={props.active}
        onMouseEnter={props.onMouseOver}
        onMouseLeave={props.onMouseOut}
        disabled={props.disabled || !canEditProposalSignal.value}
      >
        {props.icon}
      </forma-toolbar-button>
    </weave-tooltip>
  )
}
