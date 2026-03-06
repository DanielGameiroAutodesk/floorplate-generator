import type { Urn } from "forma-elements"
import { useEffect, useRef } from "preact/hooks"
import {
  disconnect,
  init,
} from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/websocketBusinessLogic"
import ErrorBoundary from "./ErrorBoundary"
import { ProposalList } from "./Proposal/ProposalList"
import { captureException } from "@sentry/browser"

type ProposalListProps = {
  projectid: string
  proposalelementid?: Urn | string
  onproposalclick?: (urn: Urn) => void | string
  createproposaldisabled?: string
  clientId?: string
}

function CustomElementDependencies() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    Object.entries({
      "forma-context-menu": "/design-system/v2/forma/components/context-menu/forma-context-menu.js",
      "forma-check": "/design-system/v2/weave/components/icons/forma-check.js",
      "forma-docs-file-save": "/web-components/forma-docs-file-picker/forma-docs-file-picker.js",
      "forma-toast": "/design-system/v2/forma/components/toast/forma-toast.js",
      "weave-tile": "/design-system/v2/weave/components/tile/weave-tile.js",
      "weave-avatar": "/design-system/v2/weave/components/avatar/weave-avatar.js",
      "weave-avatarbundle": "/design-system/v2/weave/components/avatarbundle/weave-avatarbundle.js",
      "weave-close": "/design-system/v2/weave/components/icons/weave-close.js",
      "weave-progress-bar": "/design-system/v2/weave/components/progress-bar/weave-progress-bar.js",
      "weave-skeleton-item": "/design-system/v2/weave/components/skeleton-item/weave-skeleton-item.js",
      "weave-timestamp": "/design-system/v2/weave/components/timestamp/weave-timestamp.js",
    }).map(([name, src]) => {
      if (window.customElements.get(name)) return // already defined
      const elm = document.createElement("script")
      elm.setAttribute("src", src)
      elm.setAttribute("type", "module")
      ref.current?.appendChild(elm)
    })
  }, [])
  return <div ref={ref} />
}

function ProposalListContainer(props: ProposalListProps) {
  useEffect(() => {
    try {
      init({
        authcontext: props.projectid,
        baseUrl: `wss://${window.location.host}/api/multiplayer/websocket`,
      })
    } catch (e) {
      console.error("Error initializing websocket")
      console.error("Error = ", e)
      captureException(e)
    }
    return () => {
      disconnect()
    }
    //Note:: disconnect if projectID change
  }, [props.projectid])

  useEffect(() => {
    if (props.proposalelementid) {
      window.forma_websocket?.setProposalId(props.proposalelementid)
    }
  }, [props.proposalelementid])

  return (
    <ErrorBoundary>
      <CustomElementDependencies />
      <ProposalList {...props} />
    </ErrorBoundary>
  )
}

export default ProposalListContainer
