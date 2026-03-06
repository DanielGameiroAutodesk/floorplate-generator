import { canEditProposalSignal } from "src/core/edit-access-state"
import type { UnitInputProps } from "src/lib/components/UnitInput/UnitInput"
import FormUnitInput from "src/lib/components/UnitInput/UnitInput"

export default function UnitInput(props: UnitInputProps) {
  return <FormUnitInput {...props} editAccess={canEditProposalSignal.value} />
}
