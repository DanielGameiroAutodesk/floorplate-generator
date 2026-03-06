export interface ScenarioModelListServiceElement extends Omit<HTMLElement, "addEventListener" | "removeEventListener"> {
  ouiContext: OuiContext | null
  modelListPanel: ModelListPanel | null
  standardHost: StandardHostV1 | null
  scenario: ScenarioReference | null
  activeModels: ActiveModels | null
  isSyncingModel: boolean
  onNotifyScenarioUpdated: () => void
  onDisconnectScenario: () => void
}

export interface StandardHostV1 {
  token?: string | null
  settings: {
    theme: Theme
    locale: Locale
    region: Region | null
    density: Density
    canProvideTransparentHostWindow: boolean
  }
}

export type Region = string
export type Locale =
  | "cs-CZ"
  | "de-DE"
  | "en-US"
  | "es-ES"
  | "fr-FR"
  | "hu-HU"
  | "it-IT"
  | "ja-JP"
  | "ko-KR"
  | "pl-PL"
  | "pt-BR"
  | "ru-RU"
  | "zh-CN"
  | "zh-TW"
  | "tr-TR"
export type Theme = "light" | "dark"
export type Density = "high" | "medium" | "low"

export interface ScenarioReference {
  projectId: string
  fileLineageUrn: string
  fileVersionUrn: string
  scenarioId?: string
}

export interface ActiveModels {
  activeModels: ModelReference[] | null
}

export interface ModelReference {
  hubId: string
  projectId: string
  fileLineageUrn: string
  fileVersionUrn: string
  parentFolderUrn: string
  elementId?: string
}

export interface OuiContext {
  ouiHostId: string
}

export const FeatureType = {
  OwnershipTransfer: "OWNERSHIP_TRANSFER",
} as const

export type FeatureType = (typeof FeatureType)[keyof typeof FeatureType]

export const RepresentationType = {
  TerrainRepresentation: "terrainRepresentation",
  BuildingRepresentation: "buildingRepresentation",
} as const

export type RepresentationType = (typeof RepresentationType)[keyof typeof RepresentationType]

export interface ModelListPanelV1 {
  supportedOperations: SupportedOperations[]
}

export type SupportedOperations = {
  featureType: FeatureType
  representationTypeid: string
  representationName?: RepresentationType
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "scenario-model-list": JSX.HTMLAttributes<HTMLElement> &
        Partial<Omit<ScenarioModelListServiceElement, keyof HTMLElement>>
    }
  }
}
