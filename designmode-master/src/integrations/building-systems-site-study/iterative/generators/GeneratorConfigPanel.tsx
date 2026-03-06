import { MultiEditGeneratorParameters as MultiEditBuildingsV1Parameters } from "./buildings-v1"
import { EditGeneratorParameters as EditSimpleGraphV1Parameters } from "./simple-graph-v1"
import type { SiteExploreAreaGeneratorConfig, SiteExploreAreaGeneratorId } from "./generators"

type Polygon = [number, number][]

// TODO: could do some better typing here
type GeneratorIdEditorComponentMap<T> = Partial<
  Record<
    SiteExploreAreaGeneratorId,
    React.ComponentType<{
      parameters: T
      onChange: (parameters: T) => void
      disabled?: boolean
      /** Representative site polygon to use when generating previews of different building techniques */
      previewPolygon?: Polygon
    }>
  >
>

// TODO: could do some better typing here
const generatorIdToMultiEditComponentMap: GeneratorIdEditorComponentMap<any[]> = {
  "site-explore-area-buildings-v1": MultiEditBuildingsV1Parameters,
}

type MultiEditGeneratorId = keyof typeof generatorIdToMultiEditComponentMap
type MultiEditGeneratorConfig = Extract<SiteExploreAreaGeneratorConfig, { generatorId: MultiEditGeneratorId }>

type MultiGeneratorConfigPanelProps = {
  generatorId: MultiEditGeneratorId
  generators: MultiEditGeneratorConfig[]
  onChange: (generator: MultiEditGeneratorConfig[]) => void
  disabled?: boolean
  /** Representative site polygon to use when generating previews of different building techniques */
  previewPolygon?: Polygon
}

export function MultiGeneratorConfigPanel(props: MultiGeneratorConfigPanelProps) {
  const EditComponent = generatorIdToMultiEditComponentMap[props.generatorId]
  if (EditComponent == null) return null

  return (
    <EditComponent
      parameters={props.generators.map((g) => g.parameters)}
      onChange={(parameters) => {
        props.onChange(
          parameters.map((parameters, i) => ({
            ...props.generators[i],
            parameters,
          })),
        )
      }}
      disabled={props.disabled}
      previewPolygon={props.previewPolygon}
    />
  )
}

export { EditSimpleGraphV1Parameters }
