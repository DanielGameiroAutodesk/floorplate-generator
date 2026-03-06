import type { PropsWithChildren, ReactElement } from "preact/compat"
import { useState } from "preact/compat"
import stylesheet from "./ModelTreePanel.module.pcss"

export function Panel(
  props: PropsWithChildren<{
    expandedByDefault?: boolean
    headerText: string | ReactElement
  }>,
) {
  const [expanded, setExpanded] = useState(props.expandedByDefault)

  return (
    <div className={stylesheet["panel"]}>
      <div className={stylesheet["panel-header"]} onClick={() => setExpanded(!expanded)}>
        <h2>
          {" "}
          {expanded ? "⏷" : "⏵"}
          {props.headerText}
        </h2>
      </div>
      {expanded && <div className={stylesheet["panel-content"]}>{props.children}</div>}
    </div>
  )
}

export function PanelContentForm(props: PropsWithChildren) {
  return <div className={stylesheet["panel-form-content"]}>{props.children}</div>
}
