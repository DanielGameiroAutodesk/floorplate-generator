export async function getUserinfo(): Promise<{ sub: string; email: string }> {
  const cached = sessionStorage.getItem("forma-userinfo")
  if (cached) return JSON.parse(cached)
  return new Promise((resolve) => {
    window.addEventListener("forma-userinfo-updated", () => {
      resolve(JSON.parse(sessionStorage.getItem("forma-userinfo")!))
    })
  })
}

export function getCurrentUserId(): string | undefined {
  const sessionStoredUserInfo = sessionStorage.getItem("forma-userinfo")
  if (sessionStoredUserInfo) return JSON.parse(sessionStoredUserInfo).sub
}
