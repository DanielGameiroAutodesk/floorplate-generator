import { captureException } from "@sentry/browser"
import { initialize, tryCatchSync } from "./websocketInternal"

export type UserWithConnectionId = {
  user_id: string
  email: string
  picture?: string
  given_name?: string
  family_name?: string
  connectionId: string
}

export type Connection = {
  id: string
  created: string
  updated: string
  authcontext: string
  user: UserWithConnectionId
  payload: { [key: string]: unknown }
  latestMessageTimestamp: number
}

type ExternalState = {
  connections: Array<Connection>
  me?: string // ID representing the user
}

type Parameters = {
  baseUrl?: string
  authcontext: string
  payload?: { [key: string]: unknown }
}

type UpdateParameters = Pick<Parameters, "payload">

let websocket: WebSocket | undefined

let connectionState: ExternalState = {
  connections: [],
  me: undefined,
}

function updateSessionStore(state: ExternalState) {
  sessionStorage.setItem("forma-active-connections", JSON.stringify(state.connections))
}

function reconnect(url: string): void {
  try {
    if (websocket?.readyState === WebSocket.OPEN) {
      websocket?.close()
    }

    connectionState = {
      me: connectionState.me,
      connections: [],
    }
    updateSessionStore(connectionState)

    // Connect todo handle this more gracefully
    if (url) {
      websocket = initialize(url, onSocketIsReady, onError, onMessage, onClose)
    } else {
      // noinspection ExceptionCaughtLocallyJS
      throw Error("URl was undefined when reconnecting websocket")
    }
  } catch (e) {
    console.error("Unhandled error in reconnect in websocket")
    console.error("Error = ", e)
    captureException(e)
  }
}

let proposalIdCache = {}
export function init({ authcontext, baseUrl }: Parameters): void {
  const URLParams = new URLSearchParams()
  URLParams.set("authcontext", authcontext)
  const url = `${baseUrl}?${URLParams.toString()}`

  // Initial state
  updateSessionStore(connectionState)

  // Create socket and listen
  websocket = initialize(url, onSocketIsReady, onError, onMessage, onClose)

  setInterval(() => {
    reconnect(url)
  }, 5400000) // Max connection time is 2 hours, so every 1.5 hours we reconnect.
}

export function disconnect() {
  if (websocket) websocket.close()
}

function dispatchConnectionsUpdateEvent(): void {
  window.dispatchEvent(new CustomEvent("forma-active-connections-updated"))
}

function dispatchWsConnectedEvent(): void {
  window.dispatchEvent(new CustomEvent("forma-ws-connected"))
}

function onSocketIsReady(): void {
  dispatchWsConnectedEvent()
  websocket?.send(
    JSON.stringify({
      action: "activateConnection",
      data: {
        payload: proposalIdCache,
      },
    }),
  )
}

// Filter, used to determine if an ID is unique
const uniqueById = (connection: Connection, index: number, connections: Array<Connection>): boolean =>
  index === connections.findIndex((c) => c.id === connection.id)

function onMessage(this: WebSocket, event: MessageEvent): void {
  try {
    const message = JSON.parse(event.data)
    switch (message.type) {
      case "activateConnection": {
        const me = message.data as Connection
        connectionState.me = me.id
        websocket?.send(JSON.stringify({ action: "list" }))
        break
      }
      case "list": {
        const connections = message.data as Array<Connection>
        connectionState.connections = connectionState.connections.concat(connections).filter(uniqueById)
        break
      }
      case "update": {
        const connection = message.data as Connection
        const storedConnectionWithSameId = connectionState.connections.find((c) => c.id === connection.id)
        if (storedConnectionWithSameId === undefined) {
          connectionState.connections = connectionState.connections.concat([connection])
          break
        }
        // If this update message has a higher latestMessageTimestamp than the stored one, we update, otherwise we discard
        if (storedConnectionWithSameId.latestMessageTimestamp < connection.latestMessageTimestamp) {
          connectionState.connections = connectionState.connections
            .filter((c) => c.id !== connection.id)
            .concat([connection])
        }
        // Update subscribers
        updateSessionStore(connectionState)
        dispatchConnectionsUpdateEvent()
        break
      }
      case "connected": {
        const connection = message.data as Connection
        connectionState.connections = connectionState.connections
          .filter((c) => c.id !== connection.id) // Probably unnecessary, it's a new connection after all
          .concat([connection])
        break
      }
      case "disconnected": {
        const connection = message.data as Connection
        connectionState.connections = connectionState.connections.filter((c) => c.id !== connection.id)
        break
      }
      case "pong": {
        // Just a pong from our ping. todo move this to internal state
        break
      }

      case "event": {
        const { payload } = message
        window.dispatchEvent(
          new CustomEvent("forma/websocket/event", {
            detail: { ...payload, source: "websocket" },
            bubbles: true,
            composed: true,
          }),
        )
        break
      }

      default:
        console.warn("Unexpected message from server:", message)
        break
    }

    updateSessionStore(connectionState)
    // This triggers all the subscribers with the current state
    dispatchConnectionsUpdateEvent()
  } catch (error) {
    console.error("Received message error:", error)
    captureException(error)
  }
}

function onClose() {
  connectionState.connections = connectionState.connections.filter((c) => c.id !== connectionState.me)
  connectionState.me = undefined
  updateSessionStore(connectionState)
  dispatchConnectionsUpdateEvent()
}

function onError(): void {
  websocket = undefined
}

function updateMyConnection({ payload }: UpdateParameters): void {
  try {
    if (websocket?.readyState === WebSocket.OPEN) {
      const latestMessageTimestamp = Date.now()
      // todo this should throw in some way if the websocket is not there
      websocket?.send(
        JSON.stringify({
          action: "update",
          data: {
            payload,
            latestMessageTimestamp,
          },
        }),
      )
    }
  } catch (e) {
    console.error("Unhandled error in updateMyConnection in websocket")
    console.error("Error = ", e)
    captureException(e)
  }
}

function setProposalId(proposalId: string) {
  proposalIdCache = { proposalId }
  updateMyConnection({ payload: { proposalId } })
}

function sendEvent(payload: unknown) {
  // todo this should throw in some way if the websocket is not there
  websocket?.send(
    JSON.stringify({
      action: "event",
      data: {
        payload,
      },
    }),
  )
}

window.forma_websocket = {
  setProposalId: tryCatchSync(setProposalId),
  sendEvent: tryCatchSync(sendEvent),
}
