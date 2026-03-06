import HelpIcon16 from "./HelpIcon16"
import { useTranslator } from "src/i18n"
import styles from "./AnalysisHeader.module.css"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import BetaTag from "src/lib/components/BetaTag/BetaTag"

type ArrowProps = {
  rotation: number
}

export const ArrowSmall = ({ rotation = 0 }: ArrowProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ transform: `rotate(${rotation}deg)`, transition: "all 200ms ease 0s" }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.65576 9.97917L3.90576 6.41921L4.59425 5.69397L8.00001 8.92712L11.4058 5.69397L12.0943 6.41922L8.34425 9.97917L8.00001 10.306L7.65576 9.97917Z"
      fill="var(--icon-color-medium)"
    />
  </svg>
)

type AnalysisHeaderProps = {
  analysisType: AnalysisType
  isRapid?: boolean
  isBeta?: boolean
  isCollapsible?: boolean
  isExpanded?: boolean
  onClick?: () => void
}

// A helper to avoid having to do full type casting.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeHackOnly<A, T extends A & string>(all: A, _include: T[]): Extract<A, T> {
  return all as Extract<A, T>
}

export function AnalysisHeader(props: AnalysisHeaderProps) {
  const t = useTranslator()
  const typeAll = typeHackOnly(props.analysisType, [
    "microclimate",
    "noise",
    "sky-component",
    "solar-panel",
    "sun",
    "wind",
  ])
  const type = typeHackOnly(props.analysisType, ["microclimate", "noise", "sky-component", "sun", "wind"])
  const analysisName = t.fallbackToUndefined(($) => $.analysisTooltips.types[typeAll].name) ?? ""
  const text = t.fallbackToUndefined(($) => $.analysisTooltips.types[type].text)
  const description = t.fallbackToUndefined(($) => $.analysisTooltips.types[type].description)
  const link = t.fallbackToUndefined(($) => $.analysisTooltips.types[type].link)
  return (
    <div
      className={styles.AnalysisHeader}
      style={{ cursor: props.isCollapsible ? "pointer" : "default" }}
      onClick={props.onClick}
    >
      <div className={styles.HeaderSection}>
        <h3 className={styles.AnalysisTitle}>{analysisName}</h3>
        {props.isBeta && <BetaTag />}
      </div>
      <div className={styles.HeaderSection}>
        {text && description && link && (
          <div className={styles.AnalysisTooltip}>
            <weave-tooltip
              nub="up-right"
              closedelay={300}
              width="234px"
              text={text}
              description={description}
              link={link}
            >
              <button className={styles.HelpButton}>
                <HelpIcon16 />
              </button>
            </weave-tooltip>
          </div>
        )}
        {props.isCollapsible && <ArrowSmall rotation={props.isExpanded ? 0 : -90} />}
      </div>
    </div>
  )
}
