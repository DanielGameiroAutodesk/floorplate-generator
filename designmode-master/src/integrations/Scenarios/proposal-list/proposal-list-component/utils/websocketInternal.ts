import { captureException } from "@sentry/browser"

let socket: WebSocket | undefined
let pingPongIntervalId: ReturnType<typeof setInterval>

export function tryCatchSync<T, U>(func: (t: T) => U) {
  return (t: T): U | undefined => {
    try {
      return func(t)
    } catch (e) {
      console.error("Unhandled error in websocket")
      console.error("Error = ", e)
      captureException(e)
    }
  }
}

function tryCatchAsync<T, U>(func: (t: T) => U) {
  return async (t: T): Promise<void> => {
    try {
      await func(t)
    } catch (e) {
      console.error("Unhandled error in websocket")
      console.error("Error = ", e)
      captureException(e)
    }
  }
}

export function initialize(
  address: string,
  onOpen: (this: WebSocket, ev: Event) => unknown,
  onError: (this: WebSocket, ev: Event) => unknown,
  onMessage: (this: WebSocket, ev: MessageEvent) => unknown,
  onClose: () => unknown,
): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close()
  }

  const ws = new WebSocket(address)
  socket = ws
  ws.onopen = tryCatchAsync(internalOnOpen(onOpen))
  ws.onclose = tryCatchSync((e: CloseEvent) => {
    onClose()
    _onClose(e)
  })
  ws.onerror = tryCatchSync(internalOnError(onError))
  ws.onmessage = tryCatchSync(onMessage)
  socket = ws

  return ws
}

async function confirmThatSocketConnectionWorks() {
  let socketSendSucceeded = false
  let socketError: unknown
  for (let count = 0; count < 5 && !socketSendSucceeded; count++) {
    try {
      socket?.send(JSON.stringify({ action: "ping" }))
      socketSendSucceeded = true
    } catch (e) {
      socketError = e
      console.warn(`Socket onReady handler fired, but send failed with error: ${String(e)}`)
      console.warn(`we will retry ${4 - count} more times`)
      await new Promise((res) => setTimeout(res, 2000))
    }
  }
  if (!socketSendSucceeded) {
    console.error("We could not connect to the socket, even though it claims to be open")
    console.error("socketError = ", socketError)
  }
  return
}

function internalOnOpen(externalOnOpen: ((this: WebSocket, ev: CloseEvent) => unknown) | null) {
  return async (event: Event) => {
    await confirmThatSocketConnectionWorks()
    pingPongIntervalId = setInterval(() => {
      try {
        if (socket?.readyState === socket?.OPEN) {
          socket?.send(JSON.stringify({ action: "ping" }))
        }
      } catch (e) {
        console.error("Unhandled error in ping in websocket")
        console.error("Error = ", e)
        captureException(e)
      }
      // Ping pong every minute. Timeout is 10, but we'll tweak this number over time.
    }, 60 * 1000)
    // @ts-expect-error: TODO
    externalOnOpen(event)
  }
}

let terminating = false
window.addEventListener("beforeunload", () => {
  terminating = true
  socket?.close()
})

function _onClose(event: CloseEvent): void {
  if (pingPongIntervalId) {
    clearInterval(pingPongIntervalId)
  }

  if (terminating) {
    return
  }

  if (socket?.readyState === WebSocket.CONNECTING && event.code === 1006) {
    // This means _something_ interrupted the connection on the client's side, not backend and this is usually low-level chrome stuff
    // so we can ignore it. Hypothesis is that we are going to navigate away and chrome is terminating the connection mid-handshake
    return
  }

  switch (event.code) {
    case 1000: // Normal close
    case 1001: // Endpoint going away
      break
    case 1002: // Endpoint terminating due to protocol error
      console.error(new Error("Connection closed: 1002"))
      break
    case 1003: // Endpoint terminating because it received data it does not understand
    case 1004: // Reserved
    case 1005: // No status code present
    case 1006: // Abnormal close
      break
    case 1007: // Endpoint terminating due to inconsistent message (e.g., non-UTF-8)
    case 1008: // Endpoint terminating due to policy violation
    case 1009: // Endpoint terminating because it received a message that is too big
    case 1010: // Client terminating because server negotiation failed
      console.error(new Error(`Connection closed: code=${event.code}, reason=${event.reason}`))
      break
    case 1011: // Server terminating connection due to unexpected condition that blocks request
      console.error(new Error("Connection closed: 1011"))
      break
    case 1012: // Service restart
      break // ignore
    case 1015: // Connection closed due to failing TLS handshake (cert invalid)
      // Note: This has occurred and if / when we end up expanding this feature we should implement some kind of fallback mechanism
      // I suspect when this happens it is mainly due to clients breaking the connection (could be extension / firewall denying websocket connections)
      break
    default:
      // Unknown reason
      console.error(new Error(`Connection closed: unknown reason, reason=${event.reason}`))
      break
  }
}

function internalOnError(internalOnError: ((this: WebSocket, ev: MessageEvent) => unknown) | null) {
  return (event: Event) => {
    console.error("Websocket error:", event)
    socket?.close()
    // @ts-expect-error: TODO
    internalOnError(event)
  }
}
