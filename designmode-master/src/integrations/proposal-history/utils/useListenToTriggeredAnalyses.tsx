import { useEffect } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { useSetRecoilState } from "recoil"
import { analyzedRevisionsState } from "src/integrations/proposal-history/proposal-history-state"
import type { AnalyzedRevision } from "./fetchAnalyzedRevisions"
import { PROJECT_ID } from "src/core/project/project"

export function useListenToTriggeredAnalyses() {
  const setAnalyzedRevisions = useSetRecoilState(analyzedRevisionsState)
  const authcontext = PROJECT_ID

  // Listen for changes on the current triggered analysis
  useEffect(() => {
    function onChange(event: CustomEvent<AnalysisCatalogChangeEventDetail>) {
      // Remove deleted analysis from list
      if ("oldItem" in event.detail && !("newItem" in event.detail)) {
        const oldItem = event.detail.oldItem as AnalyzedRevision
        setAnalyzedRevisions((prev) => prev.filter((r) => r.analysisId !== oldItem.analysisId))

        // Append new analysis to list (typically when just starting an analysis)
      } else if ("newItem" in event.detail && !("oldItem" in event.detail)) {
        const newItem = event.detail.newItem as AnalyzedRevision
        setAnalyzedRevisions((prev) => [...prev, newItem])
      } else if ("newItem" in event.detail && "oldItem" in event.detail) {
        const newItem = event.detail.newItem as AnalyzedRevision
        const oldItem = event.detail.oldItem as AnalyzedRevision

        // Ignore changes to progress percentage e.g IN_PROGRESS:0.2 => IN_PROGRESS:0.4
        if (newItem.status.startsWith("IN_PROGRESS") && oldItem.status.startsWith("IN_PROGRESS")) {
          return
        }

        // Replace updated analysis (e.g going from IN_PROGRESS to SUCCEEDED on an analysis
        if (newItem.status !== oldItem.status) {
          setAnalyzedRevisions((prev) => prev.map((r) => (r.analysisId === newItem.analysisId ? newItem : r)))
        }
      }
    }
    analysisCatalogWebsocket.addChangeListener(authcontext, onChange)
    return () => analysisCatalogWebsocket.removeChangeListener(authcontext, onChange)
  }, [authcontext, setAnalyzedRevisions])
}

const WEBSOCKET_ENDPOINT = `wss://${window.location.host}/api/analysis-catalog-ws`
const WEBSOCKET_MAX_RECONNECT_COUNT = 10
const WEBSOCKET_MAX_RECONNECT_TIMEOUT = 10000

type AnalysisStatus = "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "STOPPED" | "INVALIDATED"

type AnalysisStatusWithExtra =
  | AnalysisStatus
  | `IN_PROGRESS:${number}`
  | `FAILED:${string}`
  | `STOPPED:${string}`
  | `INVALIDATED:${string}`

interface AnalysisCatalogItem {
  analysisId: string
  analysisType: string
  elementUrn?: string
  createdAt: number
  updatedAt: number
  status: AnalysisStatusWithExtra
}

type AnalysisCatalogChangeEventDetail =
  | {
      newItem: AnalysisCatalogItem
    }
  | {
      newItem: AnalysisCatalogItem
      oldItem: AnalysisCatalogItem
      changedKeys: string[]
    }
  | {
      oldItem: AnalysisCatalogItem
    }

type AnalysisCatalogWebsocketChangeListener = (e: CustomEvent<AnalysisCatalogChangeEventDetail>) => void

class AnalysisCatalogWebsocket extends EventTarget {
  private authContext: string
  private socket: WebSocket | undefined
  private reconnectCount = 0
  private reconnectTimeoutId: NodeJS.Timeout | undefined
  public changeEventListeners: Set<AnalysisCatalogWebsocketChangeListener> = new Set()

  constructor(authContext: string) {
    super()
    this.authContext = authContext
    this.socket = this.connect()
  }

  private connect() {
    try {
      const socket = new WebSocket(`${WEBSOCKET_ENDPOINT}?authcontext=${this.authContext}`)
      socket.addEventListener("close", this.onSocketClose.bind(this))
      socket.addEventListener("message", this.onSocketMessage.bind(this))
      socket.addEventListener("error", this.onSocketError.bind(this))
      return socket
    } catch (err) {
      captureException(new Error("Failed to create WebSocket", { cause: err }))
    }
  }

  private onSocketClose(event: WebSocketEventMap["close"]) {
    if (event.code === 1000) return // OK/normal close
    this.reconnect()
  }

  private onSocketError() {
    this.socket?.close(4001)
  }

  private onSocketMessage(event: WebSocketEventMap["message"]) {
    let jsonObj
    try {
      jsonObj = JSON.parse(event.data)
    } catch (err) {
      captureException(new Error("Failed to parse message", { cause: err }))
      return
    }

    if (!("newItem" in jsonObj) && !("oldItem" in jsonObj)) {
      return
    }

    this.dispatchEvent(
      new CustomEvent<AnalysisCatalogChangeEventDetail>("Change", {
        bubbles: true,
        composed: true,
        detail: jsonObj as AnalysisCatalogChangeEventDetail,
      }),
    )
  }

  private reconnect() {
    if (this.reconnectTimeoutId) return // already reconnecting
    if (this.reconnectCount >= WEBSOCKET_MAX_RECONNECT_COUNT) {
      const onActivity = () => {
        // Activity detected
        this.reconnectCount = 0
        this.reconnect()
        window.removeEventListener("click", onActivity)
        window.removeEventListener("mousemove", onActivity)
      }
      window.addEventListener("click", onActivity)
      window.addEventListener("mousemove", onActivity)
      return
    }
    const timeout = 2 ** (this.reconnectCount + 1) * 500 // exponential backoff
    this.reconnectTimeoutId = setTimeout(
      () => {
        this.socket = this.connect()
        this.reconnectTimeoutId = undefined
        this.reconnectCount++
        if (!this.socket) this.reconnect()
      },
      Math.min(WEBSOCKET_MAX_RECONNECT_TIMEOUT, timeout),
    )
  }

  close() {
    this.socket?.close(1000)
  }

  // @ts-expect-error: Override EventTarget signature.
  addEventListener(type: "Change", listener: AnalysisCatalogWebsocketChangeListener): void {
    super.addEventListener(type, listener as EventListener)
    this.changeEventListeners.add(listener)
  }

  // @ts-expect-error: Override EventTarget signature.
  removeEventListener(type: "Change", listener: AnalysisCatalogWebsocketChangeListener): void {
    super.removeEventListener(type, listener as EventListener)
    this.changeEventListeners.delete(listener)
  }
}

type AnalysisCatalogChangeEventListener = (event: CustomEvent<AnalysisCatalogChangeEventDetail>) => void

interface AnalysisCatalogGlobals {
  socketInstances: Map<string, AnalysisCatalogWebsocket>
}

declare global {
  interface Window {
    __FORMA_ANALYSIS_CATALOG_GLOBALS_V2__?: AnalysisCatalogGlobals
  }
}

let globals = window.__FORMA_ANALYSIS_CATALOG_GLOBALS_V2__
if (!window.__FORMA_ANALYSIS_CATALOG_GLOBALS_V2__) {
  globals = {
    socketInstances: new Map(),
  }
  window.__FORMA_ANALYSIS_CATALOG_GLOBALS_V2__ = globals
}

export const analysisCatalogWebsocket = {
  addChangeListener(authContext: string, listener: AnalysisCatalogChangeEventListener) {
    let socket = globals!.socketInstances.get(authContext)
    if (!socket) {
      socket = new AnalysisCatalogWebsocket(authContext)
      globals!.socketInstances.set(authContext, socket)
    }
    socket.addEventListener("Change", listener)
  },
  removeChangeListener(authContext: string, listener: AnalysisCatalogChangeEventListener) {
    const socket = globals!.socketInstances.get(authContext)
    if (!socket) return

    socket.removeEventListener("Change", listener)
    if (socket.changeEventListeners.size === 0) {
      socket.close()
      globals!.socketInstances.delete(authContext)
    }
  },
}
