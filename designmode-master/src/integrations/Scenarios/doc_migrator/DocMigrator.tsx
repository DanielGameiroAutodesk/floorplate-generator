import { useState, useEffect } from "preact/hooks"
import {
  deleteScenarioModel,
  getScenario,
  type GetScenarioResponse,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import { SITE_DESIGN_AUTHORING_ENGINE } from "src/integrations/Scenarios/scenario"
import type { Urn } from "forma-elements"
import { parseUrn } from "src/lib/element/urn"

type MigrationState = "loading" | "ready" | "processing" | "error"

export const DocMigrator = () => {
  const queryParams = new URLSearchParams(window.location.search)
  const accProjectId = queryParams.get("accProjectId")
  const fileUrn = queryParams.get("fileUrn")
  const scenarioId = queryParams.get("scenarioId")

  const [state, setState] = useState<MigrationState>("loading")
  const [scenarioData, setScenarioData] = useState<GetScenarioResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accProjectId || !fileUrn || !scenarioId) {
      setError("Missing required parameters: accProjectId, fileUrn, or scenarioId")
      setState("error")
      return
    }

    getScenario({
      projectId: accProjectId,
      fileUrn,
      scenarioId,
    })
      .then((scenario) => {
        setScenarioData(scenario)
        const siteDesign = scenario.models.find((model) => model.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE)
        if (siteDesign) {
          if (!siteDesign.sourceReference?.startsWith("doc_")) {
            try {
              const { authcontext, id } = parseUrn(siteDesign.sourceReference as Urn)
              if (authcontext !== undefined && id !== undefined) {
                const redirectUrl = `/designmode/${authcontext}/${id}`
                window.location.href = redirectUrl
              } else {
                setState("ready")
              }
            } catch (err) {
              console.error("Failed to parse site design source reference:", err)
              setError("Failed to parse site design source reference. Please try again.")
              setState("error")
            }
          }
          setState("ready")
        } else {
          // No Site Design model found, redirect directly to Design Mode
          const redirectUrl = `/designmode/?scenarios&scenarioId=${encodeURIComponent(scenarioId)}&accProjectId=${encodeURIComponent(accProjectId)}&fileUrn=${encodeURIComponent(fileUrn)}`
          window.location.href = redirectUrl
        }
      })
      .catch((err) => {
        console.error("Failed to fetch scenario:", err)
        setError("Failed to load scenario data. Please try again.")
        setState("error")
      })
  }, [accProjectId, fileUrn, scenarioId])

  const handleRemoveSiteDesign = () => {
    if (!scenarioData || !accProjectId || !fileUrn || !scenarioId) {
      return
    }
    setState("processing")
    const siteDesignModel = scenarioData.models?.find((model) => model.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE)
    const siteDesignModelReferenceId =
      scenarioData.scenario.models?.find((model) => model.id === siteDesignModel?.id)?.referenceId ?? ""
    deleteScenarioModel({
      projectId: accProjectId,
      fileUrn,
      scenarioId,
      referenceId: siteDesignModelReferenceId,
    })
      .then(() => {
        const redirectUrl = `/designmode/?scenarios&scenarioId=${encodeURIComponent(scenarioId)}&accProjectId=${encodeURIComponent(accProjectId)}&fileUrn=${encodeURIComponent(fileUrn)}`
        window.location.href = redirectUrl
      })
      .catch((err) => {
        console.error("Failed to remove Site Design model:", err)
        setError("Failed to remove Site Design model. Please try again.")
        setState("error")
      })
  }

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9999,
    background: "#ffffff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
    maxWidth: "520px",
    width: "90vw",
  }

  const titleStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#3c3c3c",
    margin: "0 0 16px 0",
  }

  const descriptionStyle: React.CSSProperties = {
    fontSize: "14px",
    color: "#6b6b6b",
    lineHeight: "22px",
    margin: "0 0 24px 0",
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  }

  const primaryButtonStyle: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    background: "#0696d7",
    color: "#ffffff",
    border: "none",
  }

  const secondaryButtonStyle: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    color: "#3c3c3c",
    border: "1px solid #c0c0c0",
  }

  if (state === "loading") {
    return (
      <div style={containerStyle}>
        <p style={{ fontSize: "14px", color: "#6b6b6b", textAlign: "center" }}>Loading scenario data...</p>
      </div>
    )
  }

  if (state === "processing") {
    return (
      <div style={containerStyle}>
        <p style={{ fontSize: "14px", color: "#6b6b6b", textAlign: "center" }}>Removing Site Design model...</p>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div style={containerStyle}>
        <h1 style={titleStyle}>Error</h1>
        <p style={{ fontSize: "14px", color: "#d32f2f", marginBottom: "16px" }}>{error}</p>
        <div style={buttonContainerStyle}>
          <button style={secondaryButtonStyle} onClick={() => window.history.back()}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // state === "ready"
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Site Design Migration Required</h1>
      <p style={descriptionStyle}>
        The current Site Design model associated with this scenario needs to be removed to proceed with the migration.{" "}
        <strong style={{ color: "#3c3c3c" }}>
          All existing Site Design elements will be permanently deleted and cannot be recovered.
        </strong>
      </p>
      <p style={descriptionStyle}>
        After the migration, you will need to add Site Design elements again from scratch. This includes any buildings,
        terrain modifications, or other design elements that were part of the original Site Design.
      </p>
      <div style={buttonContainerStyle}>
        <button style={primaryButtonStyle} onClick={handleRemoveSiteDesign}>
          I Understand
        </button>
      </div>
    </div>
  )
}
