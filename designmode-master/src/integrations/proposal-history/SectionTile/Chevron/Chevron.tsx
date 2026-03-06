import combineClasses from "src/lib/combineClasses"
import styles from "./Chevron.module.pcss"

export default function Chevron({ open }: { open: boolean }) {
  return (
    <div className={combineClasses([styles.Chevron], { [styles.ChevronOpen]: open })}>
      <forma-chevron-small />
    </div>
  )
}
