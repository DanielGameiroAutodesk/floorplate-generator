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

type ACCProject = {
  type: "projects"
  id: string
  attributes: { name: string }
  relationships: {
    rootFolder: { data: { type: "folders"; id: string }; meta: { link: { href: string } } }
  }
}

type Hub = {
  name: string
  created: string
  accHubId?: string
}
function getHub(hubId: string): Promise<Hub> {
  return fetch(`/api/hubs/${hubId}`).then((res) => res.json())
}

export async function getFolderContents(projectId: string, folderId: string): Promise<APIResponse<Folder[]>> {
  return fetch(`/auth-adsk-api/data/v1/projects/${projectId}/folders/${folderId}/contents`).then((res) => res.json())
}

function getProjects(hubId: string): Promise<APIResponse<ACCProject[]>> {
  return fetch(`/auth-adsk-api/project/v1/hubs/b.${hubId}/projects`).then((res) => res.json())
}

export function getProject(hubId: string, projectId: string): Promise<APIResponse<ACCProject>> {
  return fetch(`/auth-adsk-api/project/v1/hubs/b.${hubId}/projects/b.${projectId}`).then((res) => res.json())
}

export type AccInfo = { accHubId: string; accProjectId: string; accFolderId: string; projectName: string }
export type AccLookUp = Record<string, AccInfo>
export const fetchAccLookUp = async (hubId: string) => {
  const hub = await getHub(hubId)
  const accHubId = hub.accHubId ?? ""
  const accProjects = await getProjects(accHubId)
  const folderData = await Promise.all(
    accProjects.data.map(async (accProject) => {
      const subFolders = await getFolderContents(accProject.id, accProject.relationships.rootFolder.data.id)
      const projectFilesFolder = subFolders.data.find((folder) => folder.attributes.name === "Project Files")
      if (projectFilesFolder) {
        //remove the b. from the accProjectId if it exists
        return {
          accHubId,
          accProjectId: accProject.id.startsWith("b.") ? accProject.id.slice(2) : accProject.id,
          accFolderId: projectFilesFolder.id,
          name: accProject.attributes.name,
        }
      }
      throw new Error("Project Files folder not found")
    }),
  )
  const lookUp: AccLookUp = {}
  folderData.forEach((x) => {
    lookUp[x.accProjectId] = {
      accHubId: x.accHubId,
      accProjectId: x.accProjectId,
      accFolderId: x.accFolderId,
      projectName: x.name,
    }
  })

  return lookUp
}
