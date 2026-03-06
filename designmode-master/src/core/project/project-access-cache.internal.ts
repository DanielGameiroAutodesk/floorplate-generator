import { PROJECT_ID, type ProjectAccess } from "./project"

type SerializedProjectroles = {
  projectId: string
  roles: string[]
}

export function getProjectAccessFromCache(): ProjectAccess | undefined {
  const cached = sessionStorage.getItem("forma-projectroles")
  const data = cached ? (JSON.parse(cached) as SerializedProjectroles) : undefined
  if (!PROJECT_ID || data?.projectId !== PROJECT_ID) return undefined
  const canEdit = data.roles.includes("admin") || data.roles.includes("editor")
  const canView = canEdit || data.roles.includes("viewer")
  return { canEdit, canView }
}
