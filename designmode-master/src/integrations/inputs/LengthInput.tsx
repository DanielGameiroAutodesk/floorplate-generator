import type { LengthInputProps } from "src/lib/components/LengthInput/LengthInput"
import FormLengthInput from "src/lib/components/LengthInput/LengthInput"
import { canEditProposalSignal } from "src/core/edit-access-state"

export default function LengthInput(props: LengthInputProps) {
  return <FormLengthInput editAccess={canEditProposalSignal.value} {...props} />
}
