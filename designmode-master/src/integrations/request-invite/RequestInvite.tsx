import { useEffect, useState } from "preact/hooks"
import { FetchError, request } from "src/lib/request"
import { useTranslator } from "src/i18n"
import styles from "./RequestInvite.module.pcss"
import DoneIcon from "./DoneIcon"
import { AnalyticsLegacy } from "src/core/analytics"

const SERVER_STATUS = ["ALREADY_REQUESTED", "ALREADY_MEMBER", "REQUEST_LIMIT", "CAN_JOIN"] as const
type Status = "SUCCESS" | "NOT_FOUND" | "ERROR" | (typeof SERVER_STATUS)[number] | undefined

// A helper to avoid having to do full type casting.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeHackWithout<A, T extends A & string>(all: A, _exclude: T): Exclude<A, T> {
  return all as Exclude<A, T>
}

const getText = (t: ReturnType<typeof useTranslator>, status: Status): { header: string; message: string } => {
  return {
    header:
      t.fallbackToUndefined(($) => $.requestInvite.status[status!].header) ??
      t(($) => $.requestInvite.statusFallback.header),
    message:
      t.fallbackToUndefined(($) => $.requestInvite.status[typeHackWithout(status!, "ERROR")].message) ??
      t(($) => $.requestInvite.statusFallback.message),
  }
}

function getServerStatus(payload?: string): Status {
  try {
    const data = payload ? JSON.parse(payload) : {}
    return SERVER_STATUS.find((s) => s === data.status)
  } catch {
    return
  }
}

export default function RequestInvite({ projectId }: { projectId: string }) {
  const t = useTranslator()
  const [isRequesting, setIsRequesting] = useState(false)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track("Project - Request invite page")
  }, [])

  const onRequestInvite = () => {
    async function run() {
      try {
        setIsRequesting(true)
        await request("/api/project-invite/request", {
          method: "POST",
          body: JSON.stringify({ projectId }),
        })
        setStatus("SUCCESS")
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Project - Requested invite")
      } catch (e) {
        if (e instanceof FetchError) {
          if (e.responseCode === 404) {
            setStatus("NOT_FOUND")
            return
          }
          const serverStatus = getServerStatus(e.body)
          setStatus(serverStatus ?? "ERROR")
        }
      } finally {
        setIsRequesting(false)
      }
    }
    void run()
  }

  if (isRequesting) {
    return (
      <>
        <weave-progress size="s" style={{ color: "var(--background-color-surface-100)" }} />
        <p>Sending request...</p>
      </>
    )
  }

  const text = getText(t, status)
  return (
    <div className={styles.requestInvite}>
      {status === "SUCCESS" && (
        <div className={styles.done}>
          <DoneIcon />
        </div>
      )}
      <h1>{text.header}</h1>
      <p>{text.message}</p>
      {(!status || status === "ERROR") && (
        <weave-button variant="solid" density="medium" onClick={onRequestInvite}>
          {t(($) => $.requestInvite.button)}
        </weave-button>
      )}
      {["ALREADY_MEMBER", "CAN_JOIN"].includes(status!) && (
        <weave-text-link className={styles.link} href={window.location.href}>
          {t(($) => $.requestInvite.projectLink)}
        </weave-text-link>
      )}
      <weave-text-link className={styles.link} href="/">
        {t(($) => $.requestInvite.homeLink)}
      </weave-text-link>
    </div>
  )
}
