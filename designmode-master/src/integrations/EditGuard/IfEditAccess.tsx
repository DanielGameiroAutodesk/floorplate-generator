import { canEditProposalSignal } from "src/core/edit-access-state"
import type { ComponentChildren } from "preact"
import type { FC } from "preact/compat"

type Props = {
  children: ComponentChildren
  viewOnlyFallback?: ComponentChildren
}
export const IfEditAccess: FC<Props> = ({ children, viewOnlyFallback }: Props) => {
  const canEdit = canEditProposalSignal.value

  if (!canEdit) return <>{viewOnlyFallback}</>

  return <>{children}</>
}
