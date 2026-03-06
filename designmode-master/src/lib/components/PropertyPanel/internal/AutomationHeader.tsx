import AutomationHeaderStyles from "./AutomationHeader.module.css"
import { Unlink } from "src/lib/components/icons/Unlink"
import { useTranslator } from "src/i18n"

export const AutomationHeader = ({
  editAccess,
  title,
  release,
  releaseTooltip,
}: {
  editAccess: boolean
  title: string
  release?: () => void
  releaseTooltip?: string
}) => {
  const t = useTranslator()
  return (
    <div className={AutomationHeaderStyles.Container}>
      <div className={AutomationHeaderStyles.Title}>{title}</div>
      <div className={AutomationHeaderStyles.AutomationLabel}>{t(($) => $.ui.automationLabel)}</div>
      <div className={AutomationHeaderStyles.Padding}></div>
      {release && (
        <weave-tooltip text={releaseTooltip} nub={"down-center"}>
          <weave-icon-button disabled={!editAccess} onClick={release}>
            <Unlink />
          </weave-icon-button>
        </weave-tooltip>
      )}
    </div>
  )
}
