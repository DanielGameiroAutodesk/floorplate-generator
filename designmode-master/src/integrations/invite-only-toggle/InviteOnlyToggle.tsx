import { PROJECT_ID } from "src/core/project/project"
import useLazyLoadScript from "src/lib/useLazyLoadScript"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-invite-only-toggle-component": JSX.HTMLAttributes<HTMLElement> & {
        projectid?: string | undefined
      }
    }
  }
}

export const InviteOnlyToggle = () => {
  useLazyLoadScript("/web-components/forma-invite-only-toggle-component/forma-invite-only-toggle-component.js", "atlas")
  return <forma-invite-only-toggle-component projectid={PROJECT_ID} />
}
