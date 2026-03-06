import "./checkWebGL"
import { render } from "preact"
import App from "./app/App"
import { RecoilRoot } from "recoil"
import "./core/sentry"
import "./lib/array-at"
import { request } from "./lib/request"
import { PROJECT_ID } from "./core/project/project"
import { captureException } from "@sentry/browser"
import ErrorBoundary from "./app/components/ErrorBoundary/ErrorBoundary"
import { CurrentLocation } from "./lib/location"
import { getLastVisitedOrFirstProposalId } from "./app/getLastVisitedOrFirstProposalId"
import { SpaceSetup } from "./integrations/spaces/space-setup-temp/SpaceSetup"
import { ScenarioSetup } from "./integrations/Scenarios/scenarioSetup"
import { DocMigrator } from "./integrations/Scenarios/doc_migrator/DocMigrator"

const proposalId = CurrentLocation.getProposalId()
const throwProposalNotFound = () => {
  const error = new Error("PROPOSAL_NOT_FOUND")
  captureException(error)
}
const queryParams = new URLSearchParams(window.location.search)

if (queryParams.has("space-setup")) {
  //create beside space-setup ?scenarioBootstrap or scenario-bootstrap
  // the scenario id is passed, and should then be used to bootstrap a site design, if it does not exist.
  // Make sure that the scenario then knows of this site, and that the site knows its part of a scenario
  render(<SpaceSetup />, document.getElementById("root")!)
} else if (queryParams.has("scenarios") && (!PROJECT_ID || PROJECT_ID.length === 0)) {
  try {
    //await redirectFromScenario()
    render(<ScenarioSetup />, document.getElementById("root")!)
  } catch (err) {
    console.error("Failed to redirectFromScenario", { err })
  }
} else if (!PROJECT_ID || PROJECT_ID.length === 0) {
  window.location.href = `/`

  //if doc_ we remove site design model on FP autcontext and redirect to designmode
} else if (PROJECT_ID.startsWith("doc_")) {
  render(<DocMigrator />, document.getElementById("root")!)
} else if (!proposalId || proposalId.length === 0) {
  request(`/api/proposal/elements?authcontext=${PROJECT_ID}`)
    .then((res) => res.json())
    .then((proposals) => {
      if (!proposals.length) throwProposalNotFound()
      const navigateToProposalId = getLastVisitedOrFirstProposalId(proposals)
      if (!navigateToProposalId) throwProposalNotFound()

      window.location.href = `/designmode/${PROJECT_ID}/${navigateToProposalId}${window.location.search}`
    })
    .catch((err) => {
      console.error(err)
      document.body.innerHTML = `Couldn't find proposal`
    })
} else {
  render(
    <RecoilRoot>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </RecoilRoot>,
    document.getElementById("root")!,
  )
}
