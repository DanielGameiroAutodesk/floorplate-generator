import { captureException } from "@sentry/browser"
import type { SectionBoxItem } from "./state"
import type { SectionBox } from "./tooling/sectionBox"
import { PROJECT_ID } from "src/core/project/project"

type FetchSectionBoxesResponse = {
  authcontext: string
  name: string
  sectionId: string
  sectionBox: SectionBox
}

export const getSectionBoxes = async (): Promise<FetchSectionBoxesResponse[]> => {
  return await fetch(`/api/sections?authcontext=${PROJECT_ID}`)
    .then((res) => res.json())
    .catch((e) => {
      const message = "Unable to fetch section boxes."
      window.forma_toasts.push({ content: message, status: "error" })
      captureException(e, { tags: { owner: "squad-na-east" }, extra: { message } })
    })
}

export const putSectionBox = async (sectionBox: SectionBoxItem) => {
  return await fetch(`/api/sections/${sectionBox.id}?authcontext=${PROJECT_ID}`, {
    method: "PUT",
    body: JSON.stringify({ name: sectionBox.name, sectionBox: sectionBox.box }),
  })
    .then((res) => res.json())
    .catch((e) => {
      const message = "Unable to save section box."
      captureException(e, { tags: { owner: "squad-na-east" }, extra: { message } })
      window.forma_toasts.push({ content: message, status: "error" })
    })
}

export const deleteSectionBox = async (id: string) => {
  return await fetch(`/api/sections/${id}?authcontext=${PROJECT_ID}`, {
    method: "DELETE",
  }).catch((e) => {
    const message = "Unable to delete section box."
    captureException(e, { tags: { owner: "squad-na-east" }, extra: { message } })
    window.forma_toasts.push({ content: message, status: "error" })
  })
}
