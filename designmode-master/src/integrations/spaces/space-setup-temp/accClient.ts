type APIResponse<T> = {
  jsonapi: object
  links: object
  data: T
}
type Folder = {
  type: "folders"
  id: string
  attributes: {
    name: string
    displayName: string
  }
  links: {
    webView: {
      href: string
    }
  }
}

export type ACCProject = {
  type: "projects"
  id: string
  attributes: { name: string }
  relationships: {
    rootFolder: { data: { type: "folders"; id: string }; meta: { link: { href: string } } }
  }
}

export type AccHubAttributes = {
  teamUrn: string
  teamName: string
  hubUrn: string
  hubName: string
  hubUrl: string | null
  sourceId: string
  sourceRegion: string
  source: string
}

export type AccHub = {
  type: "Hub"
  id: string
  attributes: AccHubAttributes
}

export type AccHubsResponse = {
  data: AccHub[]
  pagination: {
    limit: number
  }
}

export async function getHubs(): Promise<AccHubsResponse> {
  return fetch(`/auth-adsk-api/workspace/v1/hubs`).then((res) => res.json())
}

export async function getFolderContents(projectId: string, folderId: string): Promise<APIResponse<Folder[]>> {
  return fetch(`/auth-adsk-api/data/v1/projects/${projectId}/folders/${folderId}/contents`).then((res) => res.json())
}
export function getProjects(hubId: string): Promise<APIResponse<ACCProject[]>> {
  return fetch(`/auth-adsk-api/project/v1/hubs/b.${hubId}/projects`).then((res) => res.json())
}
export function getUserinfo(): Promise<{ email: string }> {
  return fetch(`/api/auth/userinfo`).then((res) => res.json())
}

export type ProjectFolderData = {
  projectFilesFolder: Folder | null
  allFolders: Folder[]
}

export const getProjectFolderData = async (project: ACCProject): Promise<ProjectFolderData> => {
  const subFolders = await getFolderContents(project.id, project.relationships.rootFolder.data.id)
  const projectFilesFolder = subFolders.data.find((folder) => folder.attributes.name === "Project Files")

  return {
    projectFilesFolder: projectFilesFolder || null,
    allFolders: subFolders.data,
  }
}
