import type { Geolocation } from "src/integrations/Scenarios/geolocationSchema"
export interface FormaContextServiceElement extends Omit<HTMLElement, "addEventListener" | "removeEventListener"> {
  ouiContext: OuiContext | null
  standardHostV1: StandardHostV1 | null
  settingsV1: SettingsV1Api | null
  scenarioReferenceV1: ScenarioReference | null
  activeModelsV1: ActiveModelsV1 | null
  microAppManagementV1: MicroAppManagementV1 | null
  contextualDataV1: ContextualDataV1 | null

  onCloseSelf: (() => void) | null
  onModelComplete: ((e: CustomEvent<CreateModelResult>) => void) | null

  addEventListener(type: "modelcomplete", listener: (e: CustomEvent<CreateModelResult>) => void): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void

  removeEventListener(type: "modelcomplete", listener: (e: CustomEvent<CreateModelResult>) => void): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

export interface StandardHostV1 {
  settings: {
    theme: Theme
    locale: Locale
    region: Region | null
    density: Density
    canProvideTransparentHostWindow: boolean
  }
}

export type Region = string
export type Locale = string
export type Theme = "light" | "dark"
export type Density = "compact" | "normal" | "spacious"

export interface SettingsV1Api {
  unitSystem: "metric" | "imperial"
}

export interface ScenarioReference {
  hubId: string
  projectId: string
  fileLineageUrn: string
  fileVersionUrn: string
  parentFolderUrn: string
  scenarioId?: string
}

export interface ActiveModelsV1 {
  geolocations?: Geolocation[]
}

export interface ModelReference {
  hubId: string
  projectId: string
  fileLineageUrn: string
  fileVersionUrn: string
  parentFolderUrn: string
  elementId?: string
}

export interface ModelUpdate {
  sourceReference: string
  name: string
  geolocation: unknown
  representations: {
    type: string
    binary: string
  }[]
}

export interface MicroAppManagementV1 {
  disableState: boolean
}

export interface CreateModelResult {
  message: string
  model_name: string
  model_id: string
  model_file_urn: string
  representations: Representation[]
  scenario_file_urn: string
}

export interface Representation {
  typeid: string
  id: string
  inventoryIds: string[]
  location: string
}

export interface ContextualDataV1 {
  geolocation?: {
    latitude: number
    longitude: number
  }
}

export interface OuiContext {
  ouiHostId: string
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-context-service": JSXInternal.HTMLAttributes<HTMLElement> &
        Partial<Omit<FormaContextServiceElement, keyof HTMLElement>>
    }
  }
}
