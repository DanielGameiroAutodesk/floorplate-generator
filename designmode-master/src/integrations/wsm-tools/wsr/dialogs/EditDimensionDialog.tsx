import styles from "./EditDimensionDialog.module.pcss"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { useTranslator } from "src/i18n"
import { useLayoutEffect, useRef } from "preact/hooks"

/**
 * A modal dimension editor
 */
export function EditDimensionDialog(props: { dimId: number; initialValue: string; onClose: () => void }) {
  const t = useTranslator()
  const modal = useRef<WeaveModalElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    modal.current?.show()
    input.current?.focus()
  })

  return (
    <weave-modal ref={modal} width={"200px"} height={"150px"} onClose={() => props.onClose()}>
      <div slot={"title"}>{t(($) => $.wsm.dialogs.editDimensionTitle)}</div>
      <div slot={"content"} className={styles.Content}>
        <weave-input
          ref={input}
          type="text"
          className={styles.DimensionInput}
          id="new-dimension"
          autocomplete="off"
          value={props.initialValue}
          selected={true}
          onKeyDown={(ev) => {
            if (ev.key == "Enter") {
              FormIt.HandleHUDTextInput(props.dimId, ev.currentTarget.value)
              props.onClose()
            }
          }}
          onSubmit={(ev) => {
            FormIt.HandleHUDTextInput(props.dimId, ev.currentTarget.value)
            props.onClose()
          }}
        ></weave-input>
        <div slot={"action"} className={styles.ButtonsContainer} style={{ gap: "10px", padding: "16px 0px 0px 16px" }}>
          <weave-button
            type={"button"}
            variant="solid"
            onClick={() => {
              FormIt.HandleHUDTextInput(props.dimId, input.current?.value ?? "")
              props.onClose()
            }}
          >
            {t(($) => $.wsm.buttons.ok)}
          </weave-button>
        </div>
      </div>
    </weave-modal>
  )
}
