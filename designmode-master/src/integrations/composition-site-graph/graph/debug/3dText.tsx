import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useEffect, useMemo, useRef } from "react"
import { Vector3 } from "three"
import styles from "./DebugText.module.pcss"

const YELLOW = "#FFFF69"

export default function ThreeText({
  point,
  text,
  color = YELLOW,
}: {
  point: { x: number; y: number; z: number }
  text: string
  color: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const pointAsVector = useMemo(() => new Vector3(point.x, point.y, point.z), [point])
  const screenPos = cameraApi.worldToScreen(pointAsVector)

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.top = `${window.innerHeight - screenPos.y}px`
    ref.current.style.left = `${screenPos.x}px`
  }, [pointAsVector, screenPos.x, screenPos.y])

  return (
    <div id="3d-text-debug-" className={styles.FloatingAnnotationWrapper} style={{ pointerEvents: "none" }} ref={ref}>
      <weave-floating
        target="3d-text-debug"
        placement="bottom-start"
        show-arrow={true}
        className={styles.FloatingAnnotationContent}
        style={{ backgroundColor: color }}
      >
        <div className={styles.FloatingAnnotationPreview} style={{ paddingTop: "0.5rem" }}>
          <div>{text}</div>
        </div>
      </weave-floating>
    </div>
  )
}
