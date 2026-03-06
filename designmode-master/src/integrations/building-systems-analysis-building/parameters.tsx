import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { useTranslator } from "src/i18n"

export function AnalysisParameters({
  lineBuildingParameters,
  updateParameters,
}: {
  lineBuildingParameters: LineBuildingParameters
  updateParameters: (p: LineBuildingParameters) => void
}) {
  const t = useTranslator()
  const parameters = lineBuildingParameters.analysisParameters
  const parametersText = parameters ? JSON.stringify(parameters) : undefined

  return (
    <div style={{ border: "1px solid black" }}>
      <h2>{t(($) => $.analysis.analysisParameters)}</h2>
      <input
        type={"text"}
        onChange={(e) => {
          try {
            const json = JSON.parse(e.currentTarget.value)
            updateParameters({ ...lineBuildingParameters, analysisParameters: json })
          } catch (e) {
            console.error(e)
          }
        }}
        placeholder={"enter json here?"}
        value={parametersText}
      />
    </div>
  )
}
