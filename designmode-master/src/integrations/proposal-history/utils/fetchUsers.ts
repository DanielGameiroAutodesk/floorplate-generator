import type { FormaElement } from "@spacemakerai/element-types"
import { uniq } from "src/lib/array"
import { fetchUsers, type User } from "src/lib/users"

export async function fetchUniqueUsersFromRevisions(revisions: FormaElement[], customerId?: string) {
  const allUserIds: string[] = revisions.map((a) => a.metadata?.createdBy).filter((createdBy) => createdBy) as string[]
  const uniqueUserIds = uniq(allUserIds)

  let users: User[] = []

  if (customerId && uniqueUserIds.length) {
    users = await fetchUsers(customerId, uniqueUserIds)
  }

  return users
}
