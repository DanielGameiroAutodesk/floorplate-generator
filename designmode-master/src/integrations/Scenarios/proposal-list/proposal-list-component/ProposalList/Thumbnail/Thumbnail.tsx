import type { Urn } from "forma-elements"
import { useContext, useState } from "preact/hooks"
import ProjectIdContext from "src/integrations/Scenarios/proposal-list/proposal-list-component/Context/ProjectIdContext"
import { useEffect } from "preact/compat"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"

const thumbnailCache: Record<string, { newestRevision?: string; data?: string }> = {}

export function Thumbnail({ urn }: { urn: Urn }) {
  const projectId = useContext(ProjectIdContext)
  const [fallback, setFallback] = useState(false)
  const [, setRerender] = useState(false)
  // This funky useEffect is basically a cache mechanism for thumbnail. Whenever a proposal is updated it gets a new urn.
  // This makes the img tag go blank while we wait for fetch call on the new urn to return.
  // This coming-and-going of thumbnails whenever the user moves something in the 3d-scene is annoying.
  // What we do here is to store the thumbnails in a local cache and only update the image source when the new fetch call has returned.
  // Why don't we just keep the old urn in a local state within the component you might ask?
  // That is because this component and several of its parents are functional,
  // so they get completely rebuilt whenever the urn changes.
  useEffect(() => {
    const fetchImageAndUpdateCache = async () => {
      const cacheKey = urn.split(":").slice(0, -1).join(":")
      const revision = urn.split(":").slice(-1)[0]
      try {
        thumbnailCache[cacheKey] = { ...thumbnailCache[cacheKey], newestRevision: revision }
        const url = `/api/thumbnails/v2/${urn}?projectId=${projectId}&authcontext=${projectId}`
        const res = await fetch(url)
        if (res.status !== 200 && res.status !== 304) {
          throw new Error(`Failed to fetch thumbnail for ${urn}: ${res.status} ${res.statusText}`)
        }
        const imageBlob = await res.blob()
        const imageObjectURL = URL.createObjectURL(imageBlob)
        if (revision === thumbnailCache?.[cacheKey].newestRevision) {
          Object.assign(thumbnailCache, {
            [cacheKey]: { ...thumbnailCache[cacheKey], data: imageObjectURL },
          })

          setRerender((prev) => !prev)
          setFallback(false)
        }
      } catch {
        if (revision === thumbnailCache?.[cacheKey].newestRevision) {
          setFallback(true)
        }
      }
    }
    void fetchImageAndUpdateCache()
  }, [urn, projectId])

  if (fallback) {
    return (
      <div className={styles.fallbackWrapper}>
        <weave-tooltip nub="down-center" text="Preview is not available">
          <div className={styles.fallback}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0 2.5C0 1.11929 1.11929 0 2.5 0H11.5C12.8807 0 14 1.11929 14 2.5V9.5C14 10.8807 12.8807 12 11.5 12H10H2.59729H2.5C1.11929 12 0 10.8807 0 9.5V2.5ZM11.5 11H10.2245L5.83809 6.06566C5.17776 5.32285 4.07216 5.17763 3.24241 5.72472L1 7.20323V2.5C1 1.67157 1.67157 1 2.5 1H11.5C12.3284 1 13 1.67157 13 2.5V9.5C13 10.3284 12.3284 11 11.5 11ZM8.88652 11H2.59729C1.76886 11 1.09729 10.3284 1.09729 9.5V8.33688L3.79287 6.55958C4.20774 6.28604 4.76055 6.35865 5.09071 6.73005L8.88652 11ZM9.5 6C10.3284 6 11 5.32843 11 4.5C11 3.67157 10.3284 3 9.5 3C8.67157 3 8 3.67157 8 4.5C8 5.32843 8.67157 6 9.5 6Z"
                fill="#808080"
              />
            </svg>
          </div>
        </weave-tooltip>
      </div>
    )
  }

  const imgSrc = thumbnailCache[urn?.split(":").slice(0, -1).join(":")]?.data

  if (imgSrc) return <img src={imgSrc} height="56" width="56" alt="SitePreview" />
  return null
}
