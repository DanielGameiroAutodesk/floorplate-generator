type UnifiedProject = {
  id: string
  accProjectId: string
  name: string
  hubId: string
  accHubId: string
  inviteOnly: boolean
  status: string
  allowAIRendering: boolean
}

export async function GetUnifiedProject(id: string): Promise<UnifiedProject> {
  return fetch(`/api/unified-projects/${id}`).then((res) => res.json())
}
