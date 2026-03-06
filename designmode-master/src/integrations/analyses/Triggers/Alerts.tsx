import { useState } from "preact/hooks"
import { ArrowSmall } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import alertStyles from "./Alerts.module.pcss"

type AlertId = string | number

type Alert = {
  id: AlertId
  title: string
  description: string | JSX.Element
}

type Props = {
  title?: string
  alerts: Alert[]
  newDesign?: boolean
}

export function Alerts({ alerts, title = "Alerts", newDesign = false }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className={newDesign ? alertStyles.ContainerV2 : alertStyles.Container}>
      <div className={newDesign ? alertStyles.HeaderV2 : alertStyles.Header} onClick={() => setOpen((open) => !open)}>
        <div>{title}</div>
        <div className={alertStyles.HeaderMeta}>
          <span>{alerts.length}</span>
          <ArrowSmall rotation={open ? 0 : -90} />
        </div>
      </div>
      {open && (
        <div className={alertStyles.AlertListOpen} style={open ? {} : { height: "auto" }}>
          {alerts.map(({ id, title, description }) => (
            <div className={newDesign ? alertStyles.AlertListItemV2 : alertStyles.AlertListItem} key={id}>
              <div className={newDesign ? alertStyles.AlertTitleV2 : alertStyles.AlertTitle}>{title}</div>
              <div className={newDesign ? alertStyles.AlertDescriptionV2 : alertStyles.AlertDescription}>
                {description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
