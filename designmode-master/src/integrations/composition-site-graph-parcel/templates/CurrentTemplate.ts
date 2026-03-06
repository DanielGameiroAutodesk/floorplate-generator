import { computed, effect, signal } from "@preact/signals"
import { isDefined } from "src/lib/array"
import ParcelTemplateAPI from "./ParcelTemplateAPI"
import type { ParcelTemplate } from "./types"
import { toReadonlySignal } from "./signalHelpers"

const currentUserSpecifiedTemplateSignal = signal<ParcelTemplate | undefined>(undefined)

const currentTemplateStateSignal = computed<ParcelTemplate | undefined>(() => {
  if (currentUserSpecifiedTemplateSignal.value) return currentUserSpecifiedTemplateSignal.value
  if (!isDefined(ParcelTemplateAPI.templatesSignal.value)) return undefined
  const templates = Object.values(ParcelTemplateAPI.templatesSignal.value)
  return templates[0]
})

// Set currentUserSpecifiedTemplate to undefined if template is not in templateState
effect(() => {
  if (!isDefined(ParcelTemplateAPI.templatesSignal.value)) return
  if (!isDefined(currentUserSpecifiedTemplateSignal.value)) return
  if (!ParcelTemplateAPI.templatesSignal.value[currentUserSpecifiedTemplateSignal.value.id]) {
    currentUserSpecifiedTemplateSignal.value = undefined
  }
})

function setCurrentTemplate(template: ParcelTemplate) {
  currentUserSpecifiedTemplateSignal.value = template
}

export default {
  templateSignal: toReadonlySignal(currentTemplateStateSignal),
  setTemplate: setCurrentTemplate,
}
