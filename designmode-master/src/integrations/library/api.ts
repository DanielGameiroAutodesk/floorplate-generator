import type { Urn } from "@spacemakerai/element-types"
import { request } from "src/lib/request"

export enum Status {
  PENDING = "pending",
  FAILED = "failed",
  SUCCESS = "success",
}

type BaseLibraryItem = {
  authContext: string
  name?: string
  updatedAt: number
  id: string
  properties?: { [key: string]: string | boolean | number | any }
}

export type PendingLibraryItem = BaseLibraryItem & {
  status: Status.PENDING
}

export type FailedLibraryItem = BaseLibraryItem & {
  status: Status.FAILED
}

export type SuccessLibraryItem = BaseLibraryItem & {
  status: Status.SUCCESS
  urn: Urn
}

export type LibraryItem = PendingLibraryItem | FailedLibraryItem | SuccessLibraryItem

export async function fetchLibraryItems(authContext: string): Promise<LibraryItem[]> {
  return request(`/api/forma-library/?authcontext=${authContext}`).then((res) => res.json())
}

export async function fetchLibraryItem(libraryItemId: string, authcontext: string): Promise<LibraryItem | undefined> {
  const allItems = await fetchLibraryItems(authcontext)
  return allItems.find((item) => item.id === libraryItemId)
}
