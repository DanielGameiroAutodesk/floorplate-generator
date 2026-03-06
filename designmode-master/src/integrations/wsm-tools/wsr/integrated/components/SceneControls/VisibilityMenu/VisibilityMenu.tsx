import {
  setShowTerrainSignalValue,
  setTerrainMaterialSignalValue,
  showTerrainSignal,
  terrainMaterialSignal,
} from "src/core/terrain/terrain-state"
import { useEffect } from "preact/hooks"
import { ModelDiagnostics } from "./ModelDiagnostics"
import { SunApi } from "src/integrations/sun/api"
import { projectSignal } from "src/core/project/project"
import { ShowHideSurroundings } from "./ShowHideSurroundings"
import { ShowAxes } from "./ShowAxes"

const defaultSunDate = new Date()
defaultSunDate.setMonth(5)
defaultSunDate.setDate(21)
defaultSunDate.setHours(13)
defaultSunDate.setMinutes(42)
defaultSunDate.setTime(defaultSunDate.getTime() - defaultSunDate.getTimezoneOffset() * 60 * 1000)

const VisibilityMenu = () => {
  const showTerrain = showTerrainSignal.value
  const terrainMaterial = terrainMaterialSignal.value
  const projectData = projectSignal.value
  const sunDate = SunApi.sunDateSignal.value

  useEffect(() => {
    // initialize sun position
    if (sunDate === undefined && projectData?.geoLocation) {
      // create new Date object at default date's time, in timezone specified in projectData.timezone
      const getOffset = (timeZone = "UTC", date = new Date()) => {
        const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }))
        const tzDate = new Date(date.toLocaleString("en-US", { timeZone }))
        return (tzDate.getTime() - utcDate.getTime()) / 60_000
      }
      const offset = getOffset(projectData.timezone, defaultSunDate)
      const newDate = new Date(defaultSunDate.getTime() - offset * 60 * 1000)
      SunApi.setSunDateSignalValue(newDate)
      SunApi.setShowShadowSignalValue(true)
    }
  }, [sunDate, projectData])

  if (!projectData?.geoLocation) return null
  if (!sunDate) return null

  return (
    <forma-visibility-menu
      terrainToggle={{
        showTerrain,
        terrainMode: terrainMaterial,
        onToggleTerrain: setShowTerrainSignalValue,
        onTerrainModeChange: setTerrainMaterialSignalValue,
      }}
      shadowToggle={{
        showShadows: SunApi.showShadowSignal.value,
        timezone: projectData.timezone,
        lat: projectData.geoLocation[0],
        long: projectData.geoLocation[1],
        sunDate,
        onToggleShadows: SunApi.setShowShadowSignalValue,
        onSunDateChange: SunApi.setSunDateSignalValue,
        onShadowMenuChangeVisibility: SunApi.setSunGloveVisibleSignalValue,
      }}
    >
      <ShowHideSurroundings />
      <ShowAxes />
      <ModelDiagnostics />
    </forma-visibility-menu>
  )
}

export default VisibilityMenu
