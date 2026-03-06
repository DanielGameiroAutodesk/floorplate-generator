import { batch } from "@preact/signals"
import type { ComponentChildren } from "preact"
import type { I18nStringProvider, Translator } from "src/i18n"
import { explicitSignalWithReset } from "src/lib/signal"

type HoverCleanup = () => void

export type GeometryAlertsMessageId = string
export type GeometryAlertsMessage = {
  id: GeometryAlertsMessageId
  title: I18nStringProvider
  subTitle?: (t: Translator) => ComponentChildren
  icon: JSX.Element | undefined
  count?: number
  style?: "none" | "primary" | "success" | "error" | "warning"

  onClick?: () => void
  onHover?: () => void | HoverCleanup

  actions?: {
    name: I18nStringProvider
    variant?: JSX.IntrinsicElements["weave-button"]["variant"]
    onClick: () => void
    onHover?: () => void | HoverCleanup
  }[]
}

export type GeometryAlertsVisibility = "default" | "collapsed" | "open"

const [messagesSignal, setMessagesSignalValue, resetMessagesSignal] = explicitSignalWithReset<
  Record<GeometryAlertsMessageId, GeometryAlertsMessage>
>({})

const [visibilitySignal, setVisibilitySignalValue, resetVisibilitySignal] =
  explicitSignalWithReset<GeometryAlertsVisibility>("default")

export const GeometryAlertsAPI = {
  messagesSignal,

  add(this: void, message: GeometryAlertsMessage): void {
    setMessagesSignalValue((prev) => ({ ...prev, [message.id]: message }))
  },

  remove(this: void, messageId: GeometryAlertsMessageId): void {
    setMessagesSignalValue((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([existingId]) => existingId !== messageId)),
    )
  },

  visibilitySignal,

  setVisibility: setVisibilitySignalValue,

  reset(this: void) {
    batch(() => {
      resetMessagesSignal()
      resetVisibilitySignal()
    })
  },
}
