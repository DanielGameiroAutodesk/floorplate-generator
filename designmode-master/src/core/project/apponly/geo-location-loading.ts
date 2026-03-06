import { useSignalEffect } from "@preact/signals"
import { request } from "src/lib/request"
import { PROJECT_ID, setProjectGeoLocationSignalValue } from "src/core/project/project"

type ProjectGeoLocationResponse = {
  projString: string
  utmZone: number
  srid: number
  order: "xy" | "yx"
  point: [number, number]
}

function getProjectGeoLocation(projectId: string): Promise<ProjectGeoLocationResponse> {
  return request(`/api/projects/${projectId}/geoLocation?proj=default-utm`).then((res) => res.json())
}

export function useProjectGeoLocationLoading() {
  useSignalEffect(() => {
    async function setGeoLocation() {
      try {
        const location = await getProjectGeoLocation(PROJECT_ID)
        setProjectGeoLocationSignalValue(location)
      } catch (e) {
        console.warn(e)
      }
    }
    void setGeoLocation()
  })
}
