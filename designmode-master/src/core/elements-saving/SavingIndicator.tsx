import { triggerSave } from "./trigger-save"
import {
  isSavingSignal,
  notPersistedContainersSignal,
  resetSavingErrorsSignal,
  savingErrorsSignal,
} from "./state.internal"
import { useTranslator } from "src/i18n"

function retry() {
  resetSavingErrorsSignal()
  void triggerSave()
}

export const SavingIndicator = () => {
  const t = useTranslator()
  const notPersisted = notPersistedContainersSignal.value
  const saving = isSavingSignal.value
  const savingErrors = savingErrorsSignal.value

  if (import.meta.env.PROD) return null

  if (notPersisted.length === 0) {
    return null
  }

  if (savingErrors.length > 0) {
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "center", height: 36, gap: 4 }}>
        <button onClick={retry}>{t(($) => $.ui.retry)}</button>
        <p style={{ color: "red" }}>{`Saving failed:`}</p>
        <div>
          {savingErrors.map((se) => {
            switch (se.type) {
              case "SAVING_FOR_SYSTEM_NOT_IMPLEMENTED":
                return <span>{`Saving for system "${se.system}" not implemented`}</span>
              default:
                return <span>{se.type}</span>
            }
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", height: 36 }}>
      <p>{saving ? `Saving (${notPersisted.length} elements)` : `${notPersisted.length} elements to save`}</p>
    </div>
  )
}
