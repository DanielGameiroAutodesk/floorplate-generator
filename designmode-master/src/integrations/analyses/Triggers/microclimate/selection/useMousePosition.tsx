import { useEffect } from "preact/hooks"
import debounce from "lodash/debounce"
import type { Point } from "./ManageCustomCenter"
import { DEFAULT_CIRCLE_X, DEFAULT_CIRCLE_Y } from "src/integrations/analyses/Triggers/microclimate/utils/circle"

const useMousePosition = (
  handleEvent: (point: Point) => void,
  getMousePosition: () => Point | undefined,
  customCenterActive: boolean,
) => {
  useEffect(() => {
    if (!customCenterActive) return

    const handleUpdateMousePosition = debounce(
      () => {
        const point = getMousePosition?.() ?? { x: DEFAULT_CIRCLE_X, y: DEFAULT_CIRCLE_Y }
        handleEvent(point)
      },
      16,
      { leading: true, trailing: true, maxWait: 16 },
    )

    window.addEventListener("mousemove", handleUpdateMousePosition)
    return () => {
      handleUpdateMousePosition.cancel()
      window.removeEventListener("mousemove", handleUpdateMousePosition)
    }
  }, [getMousePosition, handleEvent, customCenterActive])
}

export default useMousePosition
