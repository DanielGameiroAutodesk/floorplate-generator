import { useEffect } from "preact/hooks"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import type { MessageHandlerHandle } from "@spacemakerai/web-sketch-renderer"

export interface MessageHandler {
  message: string
  handler: (payload: any) => boolean
}

export function useFormItMessageHandler(msgType: string, handler: (payload: any) => boolean) {
  const wsrMessageHandler = getMessageHandler()

  useEffect(() => {
    const handle = wsrMessageHandler.addMessageHandler(msgType, handler)
    return () => {
      wsrMessageHandler.removeMessageHandler(handle)
    }
  })
}

export function useFormItMessageHandlers(handlers: MessageHandler[]) {
  const wsrMessageHandler = getMessageHandler()

  useEffect(() => {
    const handles: MessageHandlerHandle[] = []
    for (const handler of handlers) {
      handles.push(wsrMessageHandler.addMessageHandler(handler.message, handler.handler))
    }
    return () => {
      for (const handle of handles) {
        wsrMessageHandler.removeMessageHandler(handle)
      }
    }
  })
}
