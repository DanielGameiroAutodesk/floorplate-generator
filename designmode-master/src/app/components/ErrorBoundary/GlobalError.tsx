import { PROJECT_ID } from "src/core/project/project"
import type { ComponentChildren } from "preact"
import { KNOWN_CRITICAL_ERRORS } from "./ErrorBoundary"
import styles from "./GlobalError.module.pcss"
import RequestInvite from "src/integrations/request-invite/RequestInvite"
import { useTranslator } from "src/i18n"

export function GlobalError({ error }: { error: Error }) {
  const t = useTranslator()
  let content = <h1>{error.message}</h1>
  if (error.message === "NO_ACCESS") {
    content = <RequestInvite projectId={PROJECT_ID} />
  } else if (error.message === "PROPOSAL_NOT_FOUND") {
    content = (
      <>
        <h1>{t(($) => $.proposal.errors.notFoundHeader)}</h1>
        <p>{t(($) => $.proposal.errors.notFoundMessage)}</p>
        <weave-text-link href={`/designmode/${PROJECT_ID}`}>{t(($) => $.requestInvite.projectLink)}</weave-text-link>
        <weave-text-link href="/">{t(($) => $.requestInvite.homeLink)}</weave-text-link>
      </>
    )
  } else if (error.message === "TOO_MANY_REQUESTS") {
    content = (
      <>
        <h1>{t(($) => $.proposal.errors.tooManyRequestsHeader)}</h1>
        <p>{t(($) => $.proposal.errors.tooManyRequestsMessage)}</p>
      </>
    )
  } else if (error.message === "TERRAIN_NOT_FOUND") {
    content = (
      <>
        <h1>{t(($) => $.proposal.errors.terrainNotFoundHeader)}</h1>
        <p>{t(($) => $.proposal.errors.terrainNotFoundMessage)}</p>
      </>
    )
  } else if (error.message === KNOWN_CRITICAL_ERRORS.TOPLEVEL_ERROR) {
    content = (
      <>
        <h1>{t(($) => $.proposal.errors.knownCriticalHeader)}</h1>
        <p>{t(($) => $.proposal.errors.knownCriticalMessage)}</p>
      </>
    )
  }
  return <GlobalErrorWrapper content={content} />
}

export function GlobalErrorWrapper({ content }: { content: ComponentChildren }) {
  return (
    <>
      <div className={`forma-grid-background ${styles.background}`}></div>
      <div className={`forma-grid-main ${styles.contentGrid}`}>
        <div className={styles.content}>{content}</div>
      </div>
    </>
  )
}
