import { useEffect, useLayoutEffect, useRef } from "preact/hooks"
import styles from "./StandardDialog.module.pcss"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { TRIANGLE_LIMIT_MESH_TO_BODY } from "src/integrations/wsm-tools/wsr/api/limits"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

export const NewlineToBr = (props: { value: string }) => (
  <>
    {props.value.split("\n").map((line, i) => (
      <>
        {i !== 0 && <br />}
        {line}
      </>
    ))}
  </>
)

/**
 * This dialog indicates that there are too many triangles in the model
 *
 * @returns A weave modal
 */
export function EditMeshWarningDialog(props: { onContinue: () => void }) {
  const t = useTranslator()
  const modal = useRef<WeaveModalElement>(null)

  useLayoutEffect(() => {
    modal.current?.show()
  })

  // log analytics when users see the triangle limit warning
  useEffect(() => {
    Analytics.track(
      EventName.Use,
      {
        feature_category: FeatureCategory.DesignTool,
        feature: "3dSketch",
        sub_feature: "Editing mesh over triangle limit",
      },
      { triangleLimit: TRIANGLE_LIMIT_MESH_TO_BODY },
    )
  }, [])

  return (
    <weave-modal ref={modal} width={"350px"} onClose={() => props.onContinue()} class={"no-margin-padding-clear"}>
      <div slot={"title"}>{t(($) => $.wsm.mesh.importExceededLimitsTitle)}</div>
      <div slot={"content"}>
        <NewlineToBr
          value={t(($) => $.wsm.mesh.importExceededLimitsMessage, {
            limit: TRIANGLE_LIMIT_MESH_TO_BODY.toLocaleString(),
          })}
        />
      </div>
      <div slot="actions" className={styles.Actions} style={{ gap: "10px", padding: "16px 0px 0px 16px" }}>
        <weave-button type={"button"} variant="solid" onClick={() => props.onContinue()}>
          OK
        </weave-button>
      </div>
    </weave-modal>
  )
}
