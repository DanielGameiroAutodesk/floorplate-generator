import { useEffect, useState } from "preact/hooks"
import type { Connection } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/websocketBusinessLogic"
import { captureException } from "@sentry/browser"

export function useActiveConnections(proposalElementId: string | undefined): Connection[] {
  const [activeConnections, setActiveConnections] = useState<Connection[]>([])

  useEffect(() => {
    function updateProposalId() {
      try {
        if (proposalElementId) {
          window.forma_websocket?.setProposalId(proposalElementId)
        }
      } catch (e) {
        captureException(e)
      }
    }
    window.addEventListener("forma-ws-connected", updateProposalId)
    return () => window.removeEventListener("forma-ws-connected", updateProposalId)
  }, [proposalElementId])

  useEffect(() => {
    function onActiveConnectionsChanged() {
      let connections = []
      try {
        connections = JSON.parse(sessionStorage.getItem("forma-active-connections") || "[]")
        setActiveConnections(connections)
      } catch (e) {
        captureException(e)
      }
    }

    window.addEventListener("forma-active-connections-updated", onActiveConnectionsChanged)
    return () => window.removeEventListener("forma-active-connections-updated", onActiveConnectionsChanged)
  }, [])

  return activeConnections
}
