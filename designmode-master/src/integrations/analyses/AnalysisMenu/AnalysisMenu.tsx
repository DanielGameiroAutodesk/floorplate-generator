import { useEffect, useRef } from "preact/hooks"
import { useSetRecoilState } from "recoil"
import styles from "./AnalysisMenu.module.pcss"
import type { Extension } from "src/integrations/extensions/extension-service"
import { useExtensionsHavingInstallation } from "src/integrations/extensions/extension-service"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { requestedAnalysisState } from "src/integrations/analyses/analysis-state"
import type { RefObject } from "preact"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { useTranslator } from "src/i18n"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-analysis-menu": {
        authContext?: string
        rootElementUrn?: string
        installedExtensions?: Extension[]
        allowUntoggle?: boolean
        ref: RefObject<HTMLElement>
      }
    }
  }
}

function AnalysisMenu({ allowUntoggle }: { allowUntoggle?: boolean }) {
  const t = useTranslator()
  const rootElementUrn = elementState.currentProposalSignal.value.urn
  const extensionsHavingInstallation = useExtensionsHavingInstallation()
  const setRequestedAnalysis = useSetRecoilState(requestedAnalysisState)

  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const analysisMenu = ref.current
    if (analysisMenu) {
      analysisMenu.addEventListener("analysisselected", ((event: CustomEvent<{ analysisType: AnalysisType }>) => {
        const analysisType = event.detail.analysisType
        setRequestedAnalysis(analysisType)
      }) as EventListener)
    }
  }, [ref, setRequestedAnalysis])

  return (
    <>
      <div className={styles.AnalysisMenuHolder}>
        <h3 className={styles.AnalysisTitle}>{t(($) => $.analysis.analyzeTitle)}</h3>
        <forma-analysis-menu
          ref={ref}
          authContext={PROJECT_ID}
          rootElementUrn={rootElementUrn}
          installedExtensions={extensionsHavingInstallation}
          allowUntoggle={allowUntoggle}
        ></forma-analysis-menu>
      </div>
    </>
  )
}

export default AnalysisMenu
