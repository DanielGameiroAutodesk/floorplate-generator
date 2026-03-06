import { useSignalEffect } from "@preact/signals"
import { notPersistedContainersSignal } from "src/core/elements-saving/state"
import { elementState } from "src/core/elements/ElementState"
import { projectSignal } from "src/core/project/project"

export function useAppTitle() {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return

    const project = projectSignal.value
    if (!project) return

    const unsaved = notPersistedContainersSignal.value.length > 0
    document.title = `Design - ${project.name} ${unsaved ? "*" : ""}`
  })
}
