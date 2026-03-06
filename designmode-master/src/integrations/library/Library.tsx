import useLazyLoadScript from "src/lib/useLazyLoadScript"
import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"

const FormaLibrarySkeleton = reactWcWrapper<any>("forma-library-skeleton")

export function Library(props: { contextualData?: boolean; addMenuFeature?: boolean; siteConceptFeature?: boolean }) {
  useLazyLoadScript("/web-components/sm-library-v2/sm-library-v2.js", "shareable-content")

  // The addmenufeature attribute is always true. This is tied to the old "add menu" feature experiment
  // that has since been removed. The cleanup of this attribute remains.
  return (
    <sm-library-v2
      projectid={PROJECT_ID}
      proposalurn={elementState.currentProposalSignal.value.urn}
      contextualdata={props.contextualData ? true : undefined}
      addmenufeature={props.addMenuFeature ? true : undefined}
      siteconceptfeature={props.siteConceptFeature ? true : undefined}
    />
  )
}

export function LibraryTabSkeleton() {
  useLazyLoadScript("/web-components/sm-library-v2/sm-library-v2.js", "shareable-content")
  if (!isAppInitializedSignal.value) {
    return <FormaLibrarySkeleton />
  } else {
    return null
  }
}

export function LibraryOrLoading(props: {
  contextualData?: boolean
  addMenuFeature?: boolean
  siteConceptFeature?: boolean
}) {
  if (isAppInitializedSignal.value) {
    return <Library {...props} />
  } else {
    return <LibraryTabSkeleton />
  }
}
