import { useEffect } from "preact/hooks"
import { defaultCursor } from "src/integrations/cursors/setCursor"
import { ResourceManager } from "@spacemakerai/web-sketch-renderer"
import { createCursorMap, createToolCursorMap } from "./cursors"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"

export function ToolCursors() {
  const messageHandler = getMessageHandler()
  useEffect(() => {
    if (!messageHandler) {
      return
    }
    const cursors = createCursorMap() as any
    const toolCursors = createToolCursorMap() as any

    const messageListener = new MessageListenerResource(new ResourceManager(messageHandler), "Messages")
    messageListener.addMessageHandler("FormIt.Message.kSetCursor", (cursorType: FormIt.UI.CursorType) => {
      const cursor = cursors[cursorType]

      if (cursor) {
        cursor()
      } else {
        defaultCursor()
      }
    })
    messageListener.addMessageHandler("FormIt.Message.kSetToolTypeCursor", (cursorType: FormIt.UI.CursorType) => {
      const cursor = toolCursors[cursorType]

      if (cursor) {
        cursor()
      } else {
        defaultCursor()
      }
    })

    return () => {
      messageListener.dispose()
      defaultCursor()
    }
  }, [messageHandler])
  return null
}
