import { useTranslator, type I18nStringProvider } from "src/i18n"

export type ExpandedTooltipSpec = {
  title: I18nStringProvider
  bodyText: I18nStringProvider
  icon?: JSX.Element
  helpUrl?: string
  shortcut?: string
  visible?: boolean
  position?: "left" | "right" | "bottom" | "top"
}
export const ExpandedTooltip = (
  props: ExpandedTooltipSpec & {
    target: string
    loadingDuration?: 300
  },
) => {
  const t = useTranslator()
  return (
    <forma-expanded-tooltip
      style={{ zIndex: "var(--z-dialog)" }}
      target-id={props.target}
      text={t.getText(props.title)}
      shortcut={props.shortcut}
      help-url={props.helpUrl}
      loadingduration={props.loadingDuration || 600}
      position={props.position || "left"}
      visible={props.visible}
    >
      <div>
        {props.icon && props.icon}
        <p style={{ textAlign: "left" }}>{t.getText(props.bodyText)}</p>
      </div>
    </forma-expanded-tooltip>
  )
}
