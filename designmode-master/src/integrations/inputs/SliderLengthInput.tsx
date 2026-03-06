import { canEditProposalSignal } from "src/core/edit-access-state"
import type { SliderLengthInputProps } from "src/lib/components/SliderLengthInput/SliderLengthInput"
import FormSliderLengthInput from "src/lib/components/SliderLengthInput/SliderLengthInput"

export function SliderLengthInput(props: SliderLengthInputProps) {
  return <FormSliderLengthInput editAccess={canEditProposalSignal.value} {...props} />
}
