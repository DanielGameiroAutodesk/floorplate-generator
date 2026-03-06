import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { icons } from "./icons"
import { useState } from "preact/compat"

const BlueButtonBoxStyle = `
  height: 40px;
  display: flex;
  align-items: center;
`

const BlueButtonBoxInnerStyle = (hover: boolean) => `
  height: 28px;
  width: 100%;
  margin: 0px -6px;
  padding: 0px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: ${hover ? "rgba(128, 128, 128, 0.1)" : "var(--background-color-surface-100)"};
  border: 2px;

`

const IconsWrapperStyle = `
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const BlueButtonIconStyle = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 2px;
`

const BlueButtonTitleStyle = `
  font: var(--11-medium);
`

export const AddContentButton = ({
  title,
  addCallback,
  tooltipText,
}: {
  title: string
  addCallback: undefined | ((e: MouseEvent) => void)
  tooltipText?: string
}) => {
  const [hover, setHover] = useState(false)
  return (
    <IfEditAccess>
      <div style={BlueButtonBoxStyle}>
        <div
          style={BlueButtonBoxInnerStyle(hover)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={addCallback}
        >
          <div style={BlueButtonTitleStyle}>{title}</div>
          <weave-tooltip text={tooltipText} nub={"up-right"}>
            <div style={IconsWrapperStyle}>
              <div style={BlueButtonIconStyle}>{icons.addFeature}</div>
            </div>
          </weave-tooltip>
        </div>
      </div>
    </IfEditAccess>
  )
}
