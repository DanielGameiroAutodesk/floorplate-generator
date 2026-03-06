import { explicitSignal } from "src/lib/signal"
import { getProjectAccessFromCache } from "./project-access-cache.internal"
import { getTranslator } from "src/i18n"
import { computed } from "@preact/signals"

export type Project = {
  name: string
  version: number
  // latitude, longitude
  geoLocation?: [number, number]
  timezone: string
  customerId: string
  hubId: string
  id: string
  unifiedProjectId: string
  countryCode: string
  tags?: string[]
  created: number
  archived?: number
}

export type ProjectGeoLocation = {
  srid: number
  point: [number, number]

  // Less commonly used fields:
  projString: string // Exposed through extension API, otherwise not used
  utmZone?: number // Used for sun position UTM grid convergence correction, otherwise not used
}

export type ProjectAccess = {
  canEdit: boolean
  canView: boolean
}

/**
 * The Forma project ID used for this session.
 *
 * If the project ID changes there will be a forced refresh.
 */
export const PROJECT_ID = window.location.pathname.split("/")[2]

/**
 * The current project.
 */
const [projectSignal, setProjectSignalValue] = explicitSignal<Project | undefined>(undefined)

/**
 * Geo location for the current project.
 */
const [projectGeoLocationSignal, setProjectGeoLocationSignalValue] = explicitSignal<ProjectGeoLocation | undefined>(
  undefined,
)

/**
 * Access for the current project, based on project roles.
 */
const [projectAccessSignal, setProjectRolesSignalValue] = explicitSignal<ProjectAccess | undefined>(
  getProjectAccessFromCache(),
)

/**
 * Whether the current project is a demo project.
 */
export const isDemoSignal = computed(() => projectSignal.value?.tags?.includes("demo") ?? false)

export const missingProjectGeoLocationToast = () => {
  const t = getTranslator()
  window.forma_toasts.push({
    content: t(($) => $.proposal.errors.missingGeoLocation),
    status: "warning",
  })
}

export const missingTerrainElementToast = () => {
  const t = getTranslator()
  window.forma_toasts.push({
    content: t(($) => $.proposal.errors.terrainNotFoundHeader),
    status: "warning",
  })
}

export {
  projectSignal,
  projectGeoLocationSignal,
  projectAccessSignal,

  /** @internal */
  setProjectSignalValue,
  /** @internal */
  setProjectGeoLocationSignalValue,
  /** @internal */
  setProjectRolesSignalValue,
}
