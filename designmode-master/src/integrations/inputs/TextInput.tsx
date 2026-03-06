import { canEditProposalSignal } from "src/core/edit-access-state"
import type { TextInputProps } from "src/lib/components/TextInput/TextInput"
import FormTextInput from "src/lib/components/TextInput/TextInput"

export default function TextInput(props: TextInputProps) {
  return <FormTextInput {...props} editAccess={canEditProposalSignal.value} />
}
