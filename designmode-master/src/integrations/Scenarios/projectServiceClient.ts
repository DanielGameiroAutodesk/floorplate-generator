import type { Project } from "src/core/project/project"

/**
 * Project and sites currently use same/similar types.
 * TODO: replace with site specific naming
 */
type ProjectDTO = {
  name: string
  countryCode: string
  unifiedProjectId: string
  // latitude, longitude
  geoLocation: [number, number]
  tags: string[]
  inviteOnly: boolean
  version: number
  metadata: Record<string, any> | undefined
}

export async function CreateSite(project: ProjectDTO): Promise<Project> {
  const res = await fetch(`/api/sites`, {
    method: "POST",
    body: JSON.stringify(project),
  })
  return await res.json()
}

export async function GetSite(authcontext: string): Promise<Project> {
  const res = await fetch(`/api/sites/${authcontext}`)
  return await res.json()
}
