import { useEffect, useState } from "preact/hooks"
import { captureException } from "@sentry/browser"

export type Role = "viewer" | "editor" | "admin"
type ProjectRole = { projectId?: string; roles: Role[] }

const getFromSession = (): ProjectRole => {
  try {
    return JSON.parse(sessionStorage["forma-projectroles"])
  } catch {
    return { projectId: undefined, roles: [] }
  }
}

export const useProjectRole = (projectId: string): { status: "success"; role: Role } | { status: "fetching" } => {
  const [sessionRoles, setSessionRoles] = useState<ProjectRole>(getFromSession())

  useEffect(() => {
    function onProjectRolesUpdated() {
      try {
        setSessionRoles(getFromSession())
      } catch (e) {
        captureException(e)
      }
    }

    window.addEventListener("forma-projectroles-updated", onProjectRolesUpdated)
    return () => window.removeEventListener("forma-projectroles-updated", onProjectRolesUpdated)
  }, [setSessionRoles])

  if (projectId !== sessionRoles.projectId) {
    return { status: "fetching" }
  }

  if (sessionRoles.roles.includes("admin")) {
    return { status: "success", role: "admin" }
  } else if (sessionRoles.roles.includes("editor")) {
    return { status: "success", role: "editor" }
  } else if (sessionRoles.roles.includes("viewer")) {
    return { status: "success", role: "viewer" }
  }

  throw new Error(`Could not determine project role for user: ${JSON.stringify(sessionRoles)}`)
}
