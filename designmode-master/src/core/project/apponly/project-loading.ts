import { useSignalEffect } from "@preact/signals"
import { type Project, PROJECT_ID, setProjectSignalValue } from "src/core/project/project"
import { elementState } from "src/core/elements/ElementState"

export function useProjectLoading() {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return

    function update() {
      const cached = sessionStorage.getItem("forma-projectdata")
      const data = cached ? (JSON.parse(cached) as Project) : undefined
      if (data?.id === PROJECT_ID) {
        if (data.version === 2) {
          setProjectSignalValue(data)
        } else {
          const [, , , proposal] = window.location.pathname.split("/")
          document.body.innerHTML = `
            <div style="margin: 30% auto; width: 500px; margin-top: 20%;">
              <h1>Project not nextgen :(</h1>
              <a href="/design/${data.id}/${proposal}">Go to design-ui</a>
            </div>
          `
          document.body.style.backgroundColor = "#ff60ff"
        }
      }
    }

    update()
    window.addEventListener("forma-projectdata-updated", update)
    return () => window.removeEventListener("forma-projectdata-updated", update)
  })
}
