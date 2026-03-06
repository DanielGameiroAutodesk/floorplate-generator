import styles from "./HistoryContributors.module.pcss"
import ContributorsIcon from "./ContributorsIcon"
import type { User } from "@sentry/browser"
import { useTranslator } from "src/i18n"

export default function HistoryContributors({ users }: { users: User[] }) {
  const t = useTranslator()
  return (
    <>
      {users.length > 0 && (
        <div id="collaborators">
          <div className={styles.ContributorsIcon}>
            <ContributorsIcon />
          </div>
          <forma-expanded-tooltip
            style={{ zIndex: "var(--z-dialog)" }}
            target-id={"collaborators"}
            text={t(($) => $.proposalHistory.contributors, { count: users.length })}
            position={"right"}
            loadingduration={300}
          >
            <div className={styles.ContributorsList}>
              {users.map((u) => (
                <div key={u.user_id}>
                  <span>
                    {u.given_name} {u.family_name}
                  </span>
                  <weave-avatar
                    key={u.user_id}
                    size={"small"}
                    name={`${u.given_name} ${u.family_name}`}
                    image={u.picture}
                    tooltip={`${u.given_name} ${u.family_name}`}
                  />
                </div>
              ))}
            </div>
          </forma-expanded-tooltip>
        </div>
      )}
    </>
  )
}
