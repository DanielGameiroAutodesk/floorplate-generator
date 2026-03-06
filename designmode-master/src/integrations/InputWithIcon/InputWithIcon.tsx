import LibInputWithIcon from "src/lib/components/InputWithIcon/InputWithIcon"
import icons from "./icons"
import { canEditProposalSignal } from "src/core/edit-access-state"

type Props = {
  icon?: JSX.Element | string
  label: string
  id: string
  min?: number
  max?: number
  step?: number
  value: number | undefined
  disabled?: boolean
  onChange: (inputValue: number) => void | undefined
  unit?: "length" | "angle" | "count"
  fulltextLabel?: boolean
  isMixed?: boolean
  metricStep?: number
  metricMin?: number
  metricMax?: number
  feetStep?: number
  debounceTime?: number
}

const isIconDefined = (icon: JSX.Element | string) => {
  return typeof icon === "string" && icon in icons
}
const InputWithIcon = (props: Props) => {
  const { icon, ...rest } = props
  const actualIcon = icon === undefined ? " " : isIconDefined(icon) ? icons[icon as string] : icon
  return <LibInputWithIcon {...rest} canEditProposal={canEditProposalSignal.value} icon={actualIcon} />
}

export default InputWithIcon
