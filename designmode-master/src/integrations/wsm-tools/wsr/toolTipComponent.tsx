import type { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import { useEffect, useRef, useState } from "preact/hooks"

/** The distance the mouse is allowed to move before the tooltip is hidden */
const MOUSE_DEAD_ZONE = 3

interface ScreenPoint {
  x: number
  y: number
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * This component displays a weave tooltip at the specified
 * position and offset. onMouseLeft is called when the mouse
 * moves far enough away from this tooltip that the tooltip
 * can be disposed. The distance is defined by @see {MOUSE_DEAD_ZONE}
 *
 */
function DisplayedToolTip({
  position,
  offset,
  text,
  onMouseLeft,
}: {
  position: ScreenPoint
  offset?: ScreenPoint
  text: string
  onMouseLeft: () => void
}) {
  const weaveToolTipRef = useRef<HTMLInputElement & { show: () => void }>(null)
  const mousePos = useRef<ScreenPoint>({ x: position.x, y: position.y })

  useEffect(() => {
    const mouseMoveHandler = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      const d = distance({ x: e.clientX, y: e.clientY }, position)
      if (d > MOUSE_DEAD_ZONE) {
        onMouseLeft()
      }
    }

    document.addEventListener("mousemove", mouseMoveHandler)

    //Removes tooltip nub
    const style = document.createElement("style")
    style.innerHTML = "#tooltip::after { display:none !important }"
    weaveToolTipRef.current!.shadowRoot!.appendChild(style)

    weaveToolTipRef.current?.show()

    return () => {
      document.removeEventListener("mousemove", mouseMoveHandler)
    }
  }, [onMouseLeft, position])

  const offsetX = offset?.x || 0
  const offsetY = offset?.y || 0

  return (
    <div
      id="WSRTooltipDebugId"
      style={{
        position: "absolute",
        zIndex: 2,
        left: position.x + 15 + offsetX,
        top: position.y + 15 + offsetY,
      }}
    >
      <weave-tooltip ref={weaveToolTipRef} text={text}></weave-tooltip>
    </div>
  )
}

declare global {
  interface Window {
    // Not sure where this might be defined.
    wsrToolTipDisplay?: number
  }
}

/**
 * This handles displaying tooltips from FormItCore
 */
export function ToolTipComponent(props: { offset?: ScreenPoint; messageHandler: MessageHandler }) {
  const [toolTipText, setToolTipText] = useState("")
  const [visible, setVisible] = useState(false)
  const [displayPos, setDisplayPos] = useState({ x: 0, y: 0 })
  const mousePos = useRef<ScreenPoint>({ x: 0, y: 0 })
  const lastTooltipRequest = useRef<string>("")

  const timerHandle = useRef<any>(null)
  const toolTipDisplayDelay = window.wsrToolTipDisplay || 500

  useEffect(() => {
    //console.log("Mounting ToolTipComponent effect")
    const handler = props.messageHandler.addMessageHandler(
      "FormIt.Message.kShowTooltip",
      (payload: { first: string }) => {
        if (payload.first) {
          const newToolTipText = payload.first

          if (newToolTipText != lastTooltipRequest.current || !visible) {
            lastTooltipRequest.current = newToolTipText

            if (timerHandle.current) {
              clearTimeout(timerHandle.current)
            }

            timerHandle.current = setTimeout(() => {
              setDisplayPos({ ...mousePos.current })
              setToolTipText(newToolTipText)
              setVisible(true)
              timerHandle.current = undefined
            }, toolTipDisplayDelay)
          }
        } else {
          if (visible) {
            setVisible(false)
            setToolTipText("")
          }
        }
      },
    )

    const mouseMoveHandler = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }
    //console.log("add mousemove")
    document.addEventListener("mousemove", mouseMoveHandler)

    return () => {
      document.removeEventListener("mousemove", mouseMoveHandler)
      props.messageHandler.removeMessageHandler(handler)
      //console.log("Dismount toolTipComponent effect")
    }
  }, [visible, setVisible, props.messageHandler, toolTipDisplayDelay, setToolTipText, setDisplayPos])

  return visible ? (
    <DisplayedToolTip
      position={displayPos}
      offset={props.offset}
      text={toolTipText}
      onMouseLeft={() => setVisible(false)}
    />
  ) : (
    <></>
  )
}
