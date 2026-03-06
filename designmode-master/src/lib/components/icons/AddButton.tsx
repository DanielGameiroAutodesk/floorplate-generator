import styles from "./AddIcon.module.css"
import { PlusIcon } from "./PlusIcon"

export const AddButton = ({ onClick }: { onClick?: (e: Event) => void }) => {
  return (
    <button className={styles.AddBtn} onClick={onClick}>
      <PlusIcon />
    </button>
  )
}
