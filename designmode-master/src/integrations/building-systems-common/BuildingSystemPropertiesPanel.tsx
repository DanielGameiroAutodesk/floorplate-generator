import { LDFlag } from "src/lib/featureToggling"
import BasicBuildingProperties from "src/integrations/building-systems-basic-building/properties/BasicBuildingProperties"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { FloorPlansMenu3dSketchBuilding } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"
import { resetSelectionSetSignal, selectedNodesSignal } from "src/core/selection/selectionState"
import BuildingIcon from "src/lib/components/icons/building/BuildingIcon"
import { elementState } from "src/core/elements/ElementState"
import { useEffect } from "preact/compat"
import { useTranslator } from "src/i18n"
import { scenarioSignal } from "src/integrations/Scenarios/scenarioState"

function routeToBuildingDesign() {
  const proposal = elementState.currentProposalSignal.peek()
  const siteId = elementState.currentProjectIdSignal.peek()
  const hasDetailsFlag = new URLSearchParams(window.location.search).has(LDFlag.DetailedBuildings)
  const flags = new URLSearchParams()
  if (hasDetailsFlag) flags.set(LDFlag.DetailedBuildings, "true")
  const root = "/buildingdesign"
  try {
    const value = JSON.stringify({ proposal: proposal.element, timestamp: Date.now() })
    sessionStorage.setItem("last-known-proposal", value)
  } catch (e) {
    console.warn("writing last-known-proposal failed", e)
  }
  window.location.href = `${root}/${siteId}/${proposal.id}?${flags.size > 0 ? flags.toString() : ""}`
}

function routeToScenarioBuildingDesign() {
  const proposal = elementState.currentProposalSignal.peek()
  const scenarioData = scenarioSignal.peek()
  const scenario = scenarioData?.scenario
  const hasDetailsFlag = new URLSearchParams(window.location.search).has(LDFlag.DetailedBuildings)

  if (!scenario?.id || !scenario?.fileId || !scenario?.accProjectId) {
    routeToBuildingDesign()
    return
  }

  const queryParams = new URLSearchParams()
  if (hasDetailsFlag) queryParams.set(LDFlag.DetailedBuildings, "true")
  queryParams.set("scenarios", "true")
  queryParams.set("details", "true")

  try {
    const value = JSON.stringify({ proposal: proposal.element, timestamp: Date.now() })
    sessionStorage.setItem("last-known-proposal", value)
  } catch (e) {
    console.warn("writing last-known-proposal failed", e)
  }

  window.location.href = `/buildingdesign/${scenario.accProjectId}/${scenario.fileId}/${scenario.id}?${queryParams.toString()}`
}

function handleRouteToBuilding() {
  const scenarioData = scenarioSignal.peek()
  const scenario = scenarioData?.scenario

  if (scenario?.id && scenario?.fileId && scenario?.accProjectId) {
    routeToScenarioBuildingDesign()
  } else {
    routeToBuildingDesign()
  }
}

function BuildingDesignTeaser() {
  const selected = selectedNodesSignal.value
  const t = useTranslator()
  if (
    selected.length === 0 ||
    selected.some(
      (node) => !node.child.urn.includes(":detailedbuilding:") && !node.child.urn.includes(":building-design:"),
    )
  ) {
    return null
  }
  return (
    <div
      style={{
        backgroundColor: "#F5F5F5",
        margin: "0 -16px 0 -16px",
        padding: "20px 16px 16px 16px",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <BuildingIcon />

      <p style={{ font: "var(--11-bold)" }}>{t(($) => $.building.buildingDesignGeometry)}</p>
      <p style={{ font: "var(--12-regular)" }}>{t(($) => $.building.buildingDesignDescription)}</p>

      <weave-button onClick={() => handleRouteToBuilding()}>{t(($) => $.building.buildingDesignButton)}</weave-button>
    </div>
  )
}

export const BuildingSystemPropertyPanel = () => {
  useErrorBoundary((error, errorInfo) => {
    console.error("BuildingSystemPropertyPanel error: ", error)
    console.warn(errorInfo)
    window.forma_toasts.push({
      content: "Error when displaying right menu after selecting building",
      status: "warning",
    })
    captureException(error, { tags: { owner: "building-systems" } })
    resetSelectionSetSignal()
  })

  useEffect(() => {
    function handleBuildingDesignNav(e: Event) {
      if ((e as any).detail?.target === "buildingdesign") {
        e.preventDefault()
        handleRouteToBuilding()
      }
    }
    window.addEventListener("forma-navbar-nav-link-clicked", handleBuildingDesignNav)
    return () => window.removeEventListener("forma-navbar-nav-link-clicked", handleBuildingDesignNav)
  }, [])

  return (
    <>
      <BuildingDesignTeaser />
      <FloorPlansMenu3dSketchBuilding />
      <BasicBuildingProperties />
    </>
  )
}
