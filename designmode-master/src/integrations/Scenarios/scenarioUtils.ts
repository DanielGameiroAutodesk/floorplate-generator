export function getCurrentScenarioId() {
  const queryParams = new URLSearchParams(window.location.search)
  const scenarioId = queryParams.get("scenarioId")
  return scenarioId
}
export function getCurrentFileUrn() {
  const queryParams = new URLSearchParams(window.location.search)
  const scenarioId = queryParams.get("fileUrn")
  return scenarioId
}
export function getCurrentAccProjectId() {
  const queryParams = new URLSearchParams(window.location.search)
  const scenarioId = queryParams.get("accProjectId")
  return scenarioId
}
