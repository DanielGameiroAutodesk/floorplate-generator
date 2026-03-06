import styles from "./GeometryAlerts.module.pcss"
import NotificationsBlueDot_16 from "src/lib/components/icons/NotificationsBlueDot_16"

export function DismissedMessagesIcon({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.MessageCenterIcon}>
      <weave-icon-button onClick={onClick}>
        <NotificationsBlueDot_16 />
      </weave-icon-button>
    </div>
  )
}
