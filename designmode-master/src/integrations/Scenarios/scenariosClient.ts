import { getFolderContents, getProject } from "./migration/accClient"

async function getUnifiedProject(unifiedProjectId: string) {
  const response = await fetch(`/api/unified-projects/${unifiedProjectId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch unified project: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data
}

export type ScenarioProjectInfo = {
  accProjectId: string
  folderId: string
}

export async function getScenarioProjectInfo(unifiedProjectId: string): Promise<ScenarioProjectInfo> {
  const unifiedProject = await getUnifiedProject(unifiedProjectId)
  const accProject = await getProject(unifiedProject.accHubId, unifiedProject.accProjectId)
  const subFolders = await getFolderContents(accProject.data.id, accProject.data.relationships.rootFolder.data.id)

  const projectFilesFolder = subFolders.data.find((folder) => folder.attributes.name === "Project Files")
  if (!projectFilesFolder) {
    throw new Error("Project Files folder not found")
  }

  return {
    accProjectId: unifiedProject.accProjectId,
    folderId: projectFilesFolder.id,
  }
}

const INITIAL_TIMEOUT_MS = 200
const BACKOFF_INCREMENTS_MS = 200
const POLL_RETRIES = 60

/**
 * Tries to poll the url and return a ArrayBuffer.
 * The poll logic for the representation-service looks like the following:
 *     303 (success) - empty body, follow Location header to download
 *     200 with status failed or timeout - job failed
 *     200 with status success and a downloadUrl in body with location to get model - job success
 *     202 with status pending or inprogress - job still processing
 * @param url
 */
export async function pollForRepresentation(url: string): Promise<ArrayBuffer> {
  let timeout = INITIAL_TIMEOUT_MS

  for (let poll = 0; poll <= POLL_RETRIES; poll++) {
    timeout = Math.round(timeout + BACKOFF_INCREMENTS_MS * poll)

    const res = await fetch(url)

    if (res.status === 202) {
      await new Promise<void>((resolve) => setTimeout(resolve, timeout))
      continue
    }

    const contentType = res.headers.get("content-type") ?? ""
    if (res.ok && contentType.includes("json")) {
      const response = (await res.json()) as {
        status: string
        downloadUrl?: string
      }

      if (!response || response.status === "failed" || response.status === "timeout") {
        console.error("Failed to get representation link")
        throw new Error("Failed to get representation link")
      }

      if (response.status === "pending" || response.status === "inprogress") {
        await new Promise<void>((resolve) => setTimeout(resolve, timeout))
        continue
      }

      if (response.status === "success" && response.downloadUrl) {
        const data = await fetch(response.downloadUrl)
        return await data.arrayBuffer()
      }
      // We have some response but it is not a expected value, still retry
      console.warn("Unhandled response from representation service", response)
      await new Promise<void>((resolve) => setTimeout(resolve, timeout))
      continue
    }

    if (!res.ok) {
      throw new Error("Failed to get representation link")
    }
    // If we get here we should have followed the location redirect and gotten a GLB in the request
    return await res.arrayBuffer()
  }

  console.error("Polling for representation link timed out")
  throw new Error("Polling for representation link timed out")
}
