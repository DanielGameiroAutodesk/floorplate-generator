import { request } from "./request"
import { v4 as uuidv4 } from "uuid"

export type User = {
  user_id: string
  family_name: string
  given_name: string
  email?: string
  picture?: string
}

export const UNNAMED_USER: User = {
  user_id: uuidv4(),
  given_name: "Unnamed",
  family_name: "User",
}

export async function fetchUsers(customerId: string, userIds: string[]): Promise<User[]> {
  const searchParams = new URLSearchParams()
  searchParams.set("workspace", customerId)
  searchParams.set("users", encodeURI(userIds.toString()))

  let fetchedUsers: User[] = []

  try {
    fetchedUsers = await request(`/api/users?${searchParams.toString()}`).then((res) => res.json())
  } catch (e) {
    console.log(e)
  }

  const userMap = fetchedUsers.reduce(
    (acc: { [id: string]: User }, user: User) => ({ ...acc, [user.user_id]: user }),
    {},
  )

  return userIds.map((id, i) => userMap[id] || { user_id: id, given_name: "Unnamed", family_name: `User ${i + 1}` })
}
