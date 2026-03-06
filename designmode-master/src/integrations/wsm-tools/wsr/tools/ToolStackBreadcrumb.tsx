import type { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import { ResourceManager } from "@spacemakerai/web-sketch-renderer"
import "./ToolStackBreadcrumb.css"
import { useEffect, useState } from "preact/hooks"
import { formItToolTypeToString } from "./toolUtils"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"

export function ToolStackBreadcrumb() {
  const messageHandler: MessageHandler = (window as any).messageHandler
  const [activeTool, setActiveTool] = useState<FormIt.ToolType>(FormIt.ToolType.CAMERA_ORBIT)
  const [focus, setFocus] = useState<FormIt.ToolType>()
  const [collapsed, setCollapsed] = useState<boolean>(true)

  const fullToolStack = FormIt.Tools.GetToolStack()
  const toolStack = collapsed ? fullToolStack.slice(4) : fullToolStack

  useEffect(() => {
    const msgListener = new MessageListenerResource(new ResourceManager(messageHandler), "BreadcrumbMessageListener")
    msgListener.addMessageHandler(
      "FormIt.Message.kToolGotFocus",
      (toolPair: { first: FormIt.ToolType; second: FormIt.ToolType }) => {
        setFocus(toolPair.first)
      },
    )

    msgListener.addMessageHandler(FormIt.Message.kToolHandled, (payload) => {
      setActiveTool(payload)
    })

    msgListener.addMessageHandler("FormIt.Message.kToolRemoved", (payload) => {
      setActiveTool(payload.first)
    })

    return () => {
      msgListener.dispose()
    }
  }, [messageHandler])

  return (
    <div className={"ToolStackBreadcrumb"}>
      <span className={"ToolStackBreadcrumbItem ToolStackHeader"} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "+" : "-"}
      </span>
      <span className={"ToolStackBreadcrumbSeparator"}> » </span>
      {toolStack.map((x: any, i: number) => (
        <>
          <span
            key={x.first}
            className={`ToolStackBreadcrumbItem ${activeTool == x.first ? "ToolStackBreadcrumbActiveTool" : ""} ${
              focus == x.first ? "ToolStackBreadcrumbFocusTool" : ""
            }`}
          >
            {formItToolTypeToString(x.first)} {x.second != 0 && formItToolTypeToString(x.second)}
          </span>
          {i < toolStack.length - 1 ? <span className={"ToolStackBreadcrumbSeparator"}> » </span> : <></>}
        </>
      ))}

      {fullToolStack.findIndex((x: any) => x.first == focus!) == -1 && (
        <>
          <span className={"ToolStackBreadcrumbSeparator"}> » </span>
          <span
            key={"active"}
            className={`ToolStackBreadcrumbItem ToolStackBreadcrumbFocusTool ${
              activeTool == focus ? "ToolStackBreadcrumbActiveTool" : ""
            }`}
          >
            {formItToolTypeToString(focus!)}
          </span>
        </>
      )}
    </div>
  )
}
