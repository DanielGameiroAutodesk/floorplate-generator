import type { ComponentChildren } from "preact"
import { useState } from "preact/compat"
import { AnalysisHeader } from "./AnalysisHeader"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import analyseHeaderStyles from "./AnalysisMenu.module.pcss"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import type { SelectableAnalysisType } from "src/integrations/analyses/Selection/analysis-selection-state"

type AnalysisSectionProps = {
  analysisType: AnalysisType
  analysisName: string
  isRapid?: boolean
  isBeta?: boolean
  children: ((isExpanded: boolean) => ComponentChildren) | ComponentChildren
}

export function AnalysisSection(props: AnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  return (
    <>
      <AnalysisHeader
        analysisType={props.analysisType}
        isRapid={props.isRapid}
        isBeta={props.isBeta}
        isCollapsible={true}
        isExpanded={isExpanded}
        onClick={() => {
          setIsExpanded((prev: boolean) => !prev)
        }}
      />
      {!props.isRapid && (
        <div className={analyseHeaderStyles.AnalyzeHeader}>
          Analysis area
          <Selection analysisType={props.analysisType as SelectableAnalysisType} />
        </div>
      )}
      <div style={{ display: isExpanded ? "" : "none" }}>
        {typeof props.children === "function" ? props.children(isExpanded) : props.children}
      </div>
    </>
  )
}
